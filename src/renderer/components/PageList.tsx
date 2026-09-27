import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { resolvePageSource } from '../core/pageSources'
import { getVisibleRange, offsetOfPage, pageAtOffset } from '../core/virtualization'
import { useDocumentStore } from '../store/documentStore'
import { useUiStore } from '../store/uiStore'
import PageCanvas from './PageCanvas'

const PAGE_GAP_PX = 24
const OVERSCAN_VIEWPORTS = 2
/** Content padding above the first page — pages scroll up under the
 *  translucent top bar, but start below it. Must match the pt-* class below. */
const TOP_PADDING_PX = 88
/** Where the "current page" is sampled, as a fraction of the viewport height. */
const READING_LINE = 0.35
const WHEEL_ZOOM_SENSITIVITY = 0.0025
const MIN_SCALE = 0.25
const MAX_SCALE = 4

interface ZoomAnchor {
  /** Pointer position within the viewport. */
  viewX: number
  viewY: number
  /** The content point (px, excluding top padding) under the pointer at the old scale. */
  contentX: number
  contentY: number
  oldScale: number
}

export default function PageList(): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDoc = useDocumentStore((s) => s.pdfDoc)
  const pages = useDocumentStore((s) => s.pages)
  const importedDocs = useDocumentStore((s) => s.importedDocs)
  const zoom = useUiStore((s) => s.zoom)
  const fitWidth = useUiStore((s) => s.fitWidth)
  const scrollToPageId = useUiStore((s) => s.scrollToPageId)
  const clearScrollToPage = useUiStore((s) => s.clearScrollToPage)
  const setCurrentPageId = useUiStore((s) => s.setCurrentPageId)
  const activeTool = useUiStore((s) => s.activeTool)

  const importedPdfDocs = useMemo(
    () => Object.fromEntries(Object.entries(importedDocs).map(([id, doc]) => [id, doc.pdfDoc])),
    [importedDocs]
  )

  const [scrollTop, setScrollTop] = useState(0)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    const observer = new ResizeObserver(([entry]) => {
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [pdfDoc])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    let raf = 0
    const onScroll = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setScrollTop(el.scrollTop))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [pdfDoc])

  // All hooks above must run unconditionally, so these fall-back-safe
  // computations (rather than the early-return guard below) are what keep
  // Math.max/etc. from blowing up before a document is open.
  const visiblePages = useMemo(() => pages.filter((p) => !p.deleted), [pages])
  const maxWidthPt = visiblePages.length > 0 ? Math.max(...visiblePages.map((p) => p.widthPt)) : 1
  const scale = fitWidth && containerSize.width > 0 ? containerSize.width / maxWidthPt : zoom
  const pageHeights = useMemo(() => visiblePages.map((p) => p.heightPt * scale + PAGE_GAP_PX), [visiblePages, scale])

  // Ctrl/⌘ + wheel (and trackpad pinch, which browsers report the same way)
  // zooms around the pointer instead of the browser zooming the whole UI.
  // Needs a non-passive native listener to be allowed to preventDefault.
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const oldScale = scaleRef.current
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY)))
      if (newScale === oldScale) return
      const rect = el.getBoundingClientRect()
      const viewX = e.clientX - rect.left
      const viewY = e.clientY - rect.top
      zoomAnchorRef.current = {
        viewX,
        viewY,
        contentX: el.scrollLeft + viewX,
        contentY: el.scrollTop + viewY - TOP_PADDING_PX,
        oldScale
      }
      useUiStore.getState().setZoom(newScale)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [pdfDoc])

  // After a wheel zoom re-renders at the new scale, scroll so the content
  // point that was under the pointer is under it again.
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current
    const el = containerRef.current
    if (!anchor || !el || anchor.oldScale === scale) return
    zoomAnchorRef.current = null
    const ratio = scale / anchor.oldScale
    el.scrollTop = anchor.contentY * ratio + TOP_PADDING_PX - anchor.viewY
    el.scrollLeft = anchor.contentX * ratio - anchor.viewX
  }, [scale])

  // Tracks the page under the reading line for the status pill / pages rail.
  const currentIdx = pageAtOffset(pageHeights, scrollTop - TOP_PADDING_PX + containerSize.height * READING_LINE)
  const currentId = visiblePages[currentIdx]?.index ?? null
  useEffect(() => {
    setCurrentPageId(currentId)
  }, [currentId, setCurrentPageId])

  // Consumes a one-shot "scroll to this page" request (e.g. clicking a
  // thumbnail) by jumping the viewport to that page's cumulative offset,
  // then clears the request so it only fires once.
  useEffect(() => {
    if (scrollToPageId === null) return
    const el = containerRef.current
    if (!el) return

    const targetIndex = visiblePages.findIndex((p) => p.index === scrollToPageId)
    if (targetIndex !== -1) {
      el.scrollTo({ top: offsetOfPage(pageHeights, targetIndex), behavior: 'smooth' })
    }
    clearScrollToPage()
  }, [scrollToPageId, pageHeights, visiblePages, clearScrollToPage])

  if (!pdfDoc || visiblePages.length === 0) return null

  const { start, end } = getVisibleRange(
    pageHeights,
    Math.max(0, scrollTop - TOP_PADDING_PX),
    containerSize.height,
    OVERSCAN_VIEWPORTS
  )

  return (
    <div
      ref={containerRef}
      className={`h-full w-full overflow-auto px-4 pb-24 pt-[88px] scroll-thin md:px-6 ${activeTool === 'select' ? '' : 'cursor-crosshair'}`}
    >
      {visiblePages.map((page, i) => (
        <PageCanvas
          key={page.index}
          source={resolvePageSource(page, pdfDoc, importedPdfDocs)}
          pageIndex={page.index}
          pageNumber={i + 1}
          widthPt={page.widthPt}
          heightPt={page.heightPt}
          scale={scale}
          active={i >= start && i < end}
        />
      ))}
    </div>
  )
}
