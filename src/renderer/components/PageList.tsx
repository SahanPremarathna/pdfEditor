import { useEffect, useMemo, useRef, useState } from 'react'
import { resolvePageSource } from '../core/pageSources'
import { getVisibleRange } from '../core/virtualization'
import { useDocumentStore } from '../store/documentStore'
import { useUiStore } from '../store/uiStore'
import PageCanvas from './PageCanvas'

const PAGE_GAP_PX = 16
const OVERSCAN_VIEWPORTS = 2

export default function PageList(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDoc = useDocumentStore((s) => s.pdfDoc)
  const pages = useDocumentStore((s) => s.pages)
  const importedDocs = useDocumentStore((s) => s.importedDocs)
  const zoom = useUiStore((s) => s.zoom)
  const fitWidth = useUiStore((s) => s.fitWidth)
  const scrollToPageId = useUiStore((s) => s.scrollToPageId)
  const clearScrollToPage = useUiStore((s) => s.clearScrollToPage)

  const importedPdfDocs = useMemo(
    () => Object.fromEntries(Object.entries(importedDocs).map(([id, doc]) => [id, doc.pdfDoc])),
    [importedDocs]
  )

  const [scrollTop, setScrollTop] = useState(0)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

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
  const visiblePages = pages.filter((p) => !p.deleted)
  const maxWidthPt = visiblePages.length > 0 ? Math.max(...visiblePages.map((p) => p.widthPt)) : 1
  const scale = fitWidth && containerSize.width > 0 ? containerSize.width / maxWidthPt : zoom
  const pageHeights = visiblePages.map((p) => p.heightPt * scale + PAGE_GAP_PX)

  // Consumes a one-shot "scroll to this page" request (e.g. clicking a
  // thumbnail in ThumbnailRail) by jumping the viewport to that page's
  // cumulative offset, then clears the request so it only fires once.
  useEffect(() => {
    if (scrollToPageId === null) return
    const el = containerRef.current
    if (!el) return

    const targetIndex = visiblePages.findIndex((p) => p.index === scrollToPageId)
    if (targetIndex !== -1) {
      const offset = pageHeights.slice(0, targetIndex).reduce((sum, h) => sum + h, 0)
      el.scrollTo({ top: offset, behavior: 'smooth' })
    }
    clearScrollToPage()
  }, [scrollToPageId, pageHeights, visiblePages, clearScrollToPage])

  if (!pdfDoc || visiblePages.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-slate-500">
        Open a PDF to get started.
      </div>
    )
  }

  const { start, end } = getVisibleRange(
    pageHeights,
    scrollTop,
    containerSize.height,
    OVERSCAN_VIEWPORTS
  )

  return (
    <div ref={containerRef} className="h-full w-full overflow-y-auto bg-slate-100 p-4">
      {visiblePages.map((page, i) => (
        <PageCanvas
          key={page.index}
          source={resolvePageSource(page, pdfDoc, importedPdfDocs)}
          pageIndex={page.index}
          widthPt={page.widthPt}
          heightPt={page.heightPt}
          scale={scale}
          active={i >= start && i < end}
        />
      ))}
    </div>
  )
}
