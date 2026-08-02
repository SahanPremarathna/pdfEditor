import { useEffect, useRef, useState } from 'react'
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
  const zoom = useUiStore((s) => s.zoom)
  const fitWidth = useUiStore((s) => s.fitWidth)

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

  if (!pdfDoc || pages.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-slate-500">
        Open a PDF to get started.
      </div>
    )
  }

  const maxWidthPt = Math.max(...pages.map((p) => p.widthPt))
  const scale = fitWidth && containerSize.width > 0 ? containerSize.width / maxWidthPt : zoom

  const pageHeights = pages.map((p) => p.heightPt * scale + PAGE_GAP_PX)
  const { start, end } = getVisibleRange(
    pageHeights,
    scrollTop,
    containerSize.height,
    OVERSCAN_VIEWPORTS
  )

  return (
    <div ref={containerRef} className="h-full w-full overflow-y-auto bg-slate-100 p-4">
      {pages.map((page, i) => (
        <PageCanvas
          key={page.index}
          pdfDoc={pdfDoc}
          pageNumber={page.index + 1}
          widthPt={page.widthPt}
          heightPt={page.heightPt}
          scale={scale}
          active={i >= start && i < end}
        />
      ))}
    </div>
  )
}
