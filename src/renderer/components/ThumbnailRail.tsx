import { Copy, FileInput, FilePlus2, PanelLeftClose, Plus, RotateCcw, RotateCw, Scissors, Trash2 } from 'lucide-react'
import type { DragEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { resolvePageSource } from '../core/pageSources'
import { renderPageToCanvas, type PDFDocumentProxy } from '../core/renderPdf'
import { useDocumentStore } from '../store/documentStore'
import { useUiStore } from '../store/uiStore'
import type { PageMeta } from '../../shared/types'

const THUMBNAIL_WIDTH_PX = 132
const PAGE_SIZES = [
  { label: 'Same size as current', size: undefined },
  { label: 'US Letter', size: { widthPt: 612, heightPt: 792 } },
  { label: 'A4', size: { widthPt: 595.28, heightPt: 841.89 } },
  { label: 'US Letter (landscape)', size: { widthPt: 792, heightPt: 612 } },
  { label: 'A4 (landscape)', size: { widthPt: 841.89, heightPt: 595.28 } }
] as const

interface ThumbnailCanvasProps {
  page: PageMeta
  pdfDoc: PDFDocumentProxy
  importedPdfDocs: Record<string, PDFDocumentProxy>
}

/** A small, non-interactive render of one page — deliberately NOT PageCanvas
 *  (which pulls in the full Konva/Transformer object-editing stack a
 *  thumbnail doesn't need). */
function ThumbnailCanvas({ page, pdfDoc, importedPdfDocs }: ThumbnailCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const source = resolvePageSource(page, pdfDoc, importedPdfDocs)
  const heightPx = (THUMBNAIL_WIDTH_PX * page.heightPt) / page.widthPt

  const sourcePdfDoc = source.kind === 'renderable' ? source.pdfDoc : null
  const sourcePageNumber = source.kind === 'renderable' ? source.pageNumber : null
  const sourceRotationDeg = source.kind === 'renderable' ? source.rotationDeg : 0
  // Rendered at device resolution so thumbnails stay crisp on HiDPI screens.
  const scale = (THUMBNAIL_WIDTH_PX / page.widthPt) * Math.min(2, window.devicePixelRatio || 1)

  useEffect(() => {
    if (!canvasRef.current || !sourcePdfDoc || sourcePageNumber === null) return undefined

    const canvas = canvasRef.current
    let cancelled = false
    let cancelFn: (() => void) | null = null
    setFailed(false)

    renderPageToCanvas(sourcePdfDoc, sourcePageNumber, canvas, scale, () => cancelled, sourceRotationDeg)
      .then((handle) => {
        if (!handle || cancelled) {
          handle?.cancel()
          return
        }
        cancelFn = handle.cancel
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      cancelFn?.()
    }
  }, [sourcePdfDoc, sourcePageNumber, sourceRotationDeg, scale])

  // Thumbnail box size is computed geometry (depends on page aspect ratio).
  const box = { width: THUMBNAIL_WIDTH_PX, height: heightPx }

  if (source.kind === 'blank') {
    return <div className="rounded-md bg-white" style={box} />
  }

  if (failed) {
    return (
      <div className="flex items-center justify-center rounded-md bg-rose-50 text-center text-[10px] text-rose-600" style={box}>
        Render failed
      </div>
    )
  }

  return <canvas ref={canvasRef} className="block rounded-md bg-white" style={box} />
}

function AddPageMenu({ afterPageId }: { afterPageId: number }): JSX.Element {
  const insertBlankPage = useDocumentStore((s) => s.insertBlankPage)
  const importPagesFromFile = useDocumentStore((s) => s.importPagesFromFile)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn btn-primary h-8 w-full rounded-lg text-xs" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus size={14} /> Add page
      </button>
      {open && (
        <div className="glass-strong absolute left-0 top-full z-40 mt-2 w-56 animate-pop-in rounded-2xl p-1.5">
          <span className="field-label block px-2.5 pb-1 pt-1.5">Blank page after current</span>
          {PAGE_SIZES.map(({ label, size }) => (
            <button
              key={label}
              type="button"
              className="menu-item"
              onClick={() => {
                setOpen(false)
                insertBlankPage(afterPageId, size)
              }}
            >
              <FilePlus2 size={15} /> {label}
            </button>
          ))}
          <div className="my-1 h-px bg-slate-900/10 dark:bg-white/10" />
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setOpen(false)
              void importPagesFromFile(afterPageId)
            }}
          >
            <FileInput size={15} /> Insert pages from PDF…
          </button>
        </div>
      )}
    </div>
  )
}

export default function ThumbnailRail(): JSX.Element | null {
  const pdfDoc = useDocumentStore((s) => s.pdfDoc)
  const pages = useDocumentStore((s) => s.pages)
  const importedDocs = useDocumentStore((s) => s.importedDocs)
  const rotatePage = useDocumentStore((s) => s.rotatePage)
  const deletePage = useDocumentStore((s) => s.deletePage)
  const reorderPages = useDocumentStore((s) => s.reorderPages)
  const duplicatePage = useDocumentStore((s) => s.duplicatePage)
  const extractPages = useDocumentStore((s) => s.extractPages)

  const lastActivePageIndex = useUiStore((s) => s.lastActivePageIndex)
  const currentPageId = useUiStore((s) => s.currentPageId)
  const setLastActivePageIndex = useUiStore((s) => s.setLastActivePageIndex)
  const requestScrollToPage = useUiStore((s) => s.requestScrollToPage)
  const isOpen = useUiStore((s) => s.isPagesPanelOpen)
  const setOpen = useUiStore((s) => s.setPagesPanelOpen)

  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const activeThumbRef = useRef<HTMLDivElement>(null)

  const importedPdfDocs = useMemo(
    () => Object.fromEntries(Object.entries(importedDocs).map(([id, doc]) => [id, doc.pdfDoc])),
    [importedDocs]
  )

  // Keep the page being read visible in the rail as the document scrolls.
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentPageId])

  if (!pdfDoc || !isOpen) return null

  const visiblePages = pages.filter((p) => !p.deleted)
  const highlightedId = currentPageId ?? lastActivePageIndex
  const addAfterId = visiblePages.some((p) => p.index === lastActivePageIndex)
    ? lastActivePageIndex
    : (visiblePages[visiblePages.length - 1]?.index ?? 0)

  const handleDragStart = (e: DragEvent<HTMLDivElement>, pageId: number): void => {
    e.dataTransfer.setData('application/x-inkline-page', String(pageId))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>, pageId: number): void => {
    if (!e.dataTransfer.types.includes('application/x-inkline-page')) return
    e.preventDefault()
    if (dragOverId !== pageId) setDragOverId(pageId)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetPageId: number): void => {
    setDragOverId(null)
    const raw = e.dataTransfer.getData('application/x-inkline-page')
    if (!raw) return
    e.preventDefault()
    const draggedPageId = Number(raw)
    if (Number.isNaN(draggedPageId)) return
    reorderPages(draggedPageId, targetPageId)
  }

  const actionClass = 'icon-btn h-7 w-7 rounded-lg bg-white/90 text-slate-700 shadow-sm hover:bg-white dark:bg-slate-800/90 dark:text-slate-200'

  return (
    <aside className="glass pointer-events-auto flex max-h-full w-[184px] shrink-0 animate-slide-in-left flex-col rounded-2xl">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <span className="text-sm font-semibold">
          Pages <span className="font-normal text-slate-400">{visiblePages.length}</span>
        </span>
        <button type="button" className="icon-btn h-7 w-7" onClick={() => setOpen(false)} aria-label="Hide pages panel">
          <PanelLeftClose size={15} />
        </button>
      </div>
      <div className="px-3 pb-2">
        <AddPageMenu afterPageId={addAfterId} />
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-3 pb-3 pt-1 scroll-thin">
        {visiblePages.map((page, i) => {
          const active = highlightedId === page.index
          return (
            <div
              key={page.index}
              ref={active ? activeThumbRef : undefined}
              draggable
              onDragStart={(e) => handleDragStart(e, page.index)}
              onDragOver={(e) => handleDragOver(e, page.index)}
              onDragLeave={() => setDragOverId((id) => (id === page.index ? null : id))}
              onDrop={(e) => handleDrop(e, page.index)}
              onDragEnd={() => setDragOverId(null)}
              onClick={() => {
                setLastActivePageIndex(page.index)
                requestScrollToPage(page.index)
              }}
              className="group relative flex cursor-grab flex-col items-center gap-1.5 active:cursor-grabbing"
            >
              {dragOverId === page.index && <div className="absolute -top-2 left-0 right-0 h-0.5 rounded-full bg-ink-500" />}
              <div
                className={`relative rounded-lg p-0.5 transition ${
                  active ? 'bg-accent-gradient shadow-lg shadow-ink-600/25' : 'bg-slate-900/10 group-hover:bg-ink-400/50 dark:bg-white/10'
                }`}
              >
                <ThumbnailCanvas page={page} pdfDoc={pdfDoc} importedPdfDocs={importedPdfDocs} />
                <div className="absolute inset-x-0 top-1.5 flex justify-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <button type="button" className={`${actionClass} tip tip-bottom`} data-tip="Rotate left" aria-label="Rotate page left" onClick={(e) => { e.stopPropagation(); rotatePage(page.index, 'ccw') }}>
                    <RotateCcw size={13} />
                  </button>
                  <button type="button" className={`${actionClass} tip tip-bottom`} data-tip="Rotate right" aria-label="Rotate page right" onClick={(e) => { e.stopPropagation(); rotatePage(page.index, 'cw') }}>
                    <RotateCw size={13} />
                  </button>
                  <button type="button" className={`${actionClass} tip tip-bottom`} data-tip="Duplicate" aria-label="Duplicate page" onClick={(e) => { e.stopPropagation(); duplicatePage(page.index) }}>
                    <Copy size={13} />
                  </button>
                </div>
                <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <button type="button" className={`${actionClass} tip tip-top`} data-tip="Extract page" aria-label="Extract page as PDF" onClick={(e) => { e.stopPropagation(); void extractPages([page.index]) }}>
                    <Scissors size={13} />
                  </button>
                  <button
                    type="button"
                    className={`${actionClass} tip tip-top text-rose-600 dark:text-rose-400`}
                    data-tip={visiblePages.length === 1 ? "Can't delete the only page" : 'Delete page'}
                    aria-label="Delete page"
                    disabled={visiblePages.length === 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      deletePage(page.index)
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <span className={`text-[11px] font-semibold tabular-nums ${active ? 'text-ink-600 dark:text-ink-300' : 'text-slate-500'}`}>
                {i + 1}
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
