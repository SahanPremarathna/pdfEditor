import type { DragEvent } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { resolvePageSource } from '../core/pageSources'
import { renderPageToCanvas, type PDFDocumentProxy } from '../core/renderPdf'
import { useDocumentStore } from '../store/documentStore'
import { useUiStore } from '../store/uiStore'
import type { PageMeta } from '../../shared/types'

const THUMBNAIL_WIDTH_PX = 120

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
  const source = resolvePageSource(page, pdfDoc, importedPdfDocs)
  const heightPx = (THUMBNAIL_WIDTH_PX * page.heightPt) / page.widthPt

  const sourcePdfDoc = source.kind === 'renderable' ? source.pdfDoc : null
  const sourcePageNumber = source.kind === 'renderable' ? source.pageNumber : null
  const sourceRotationDeg = source.kind === 'renderable' ? source.rotationDeg : 0
  const scale = THUMBNAIL_WIDTH_PX / page.widthPt

  useEffect(() => {
    if (!canvasRef.current || !sourcePdfDoc || sourcePageNumber === null) return undefined

    const canvas = canvasRef.current
    let cancelled = false
    let cancelFn: (() => void) | null = null

    renderPageToCanvas(sourcePdfDoc, sourcePageNumber, canvas, scale, () => cancelled, sourceRotationDeg).then(
      (handle) => {
        if (!handle || cancelled) {
          handle?.cancel()
          return
        }
        cancelFn = handle.cancel
      }
    )

    return () => {
      cancelled = true
      cancelFn?.()
    }
  }, [sourcePdfDoc, sourcePageNumber, sourceRotationDeg, scale])

  if (source.kind === 'blank') {
    return <div className="border border-slate-300 bg-white" style={{ width: THUMBNAIL_WIDTH_PX, height: heightPx }} />
  }

  return (
    <canvas
      ref={canvasRef}
      className="border border-slate-300"
      style={{ width: THUMBNAIL_WIDTH_PX, height: heightPx }}
    />
  )
}

export default function ThumbnailRail(): JSX.Element | null {
  const pdfDoc = useDocumentStore((s) => s.pdfDoc)
  const pages = useDocumentStore((s) => s.pages)
  const importedDocs = useDocumentStore((s) => s.importedDocs)
  const rotatePage = useDocumentStore((s) => s.rotatePage)
  const deletePage = useDocumentStore((s) => s.deletePage)
  const reorderPages = useDocumentStore((s) => s.reorderPages)
  const insertBlankPage = useDocumentStore((s) => s.insertBlankPage)
  const importPagesFromFile = useDocumentStore((s) => s.importPagesFromFile)

  const lastActivePageIndex = useUiStore((s) => s.lastActivePageIndex)
  const setLastActivePageIndex = useUiStore((s) => s.setLastActivePageIndex)
  const requestScrollToPage = useUiStore((s) => s.requestScrollToPage)

  const importedPdfDocs = useMemo(
    () => Object.fromEntries(Object.entries(importedDocs).map(([id, doc]) => [id, doc.pdfDoc])),
    [importedDocs]
  )

  if (!pdfDoc) return null

  const visiblePages = pages.filter((p) => !p.deleted)

  const handleDragStart = (e: DragEvent<HTMLDivElement>, pageId: number): void => {
    e.dataTransfer.setData('text/plain', String(pageId))
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => e.preventDefault()

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetPageId: number): void => {
    e.preventDefault()
    const draggedPageId = Number(e.dataTransfer.getData('text/plain'))
    if (Number.isNaN(draggedPageId)) return
    reorderPages(draggedPageId, targetPageId)
  }

  return (
    <div className="flex w-36 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white">
      <div className="flex gap-1 border-b border-slate-200 p-2 text-xs">
        <button
          type="button"
          onClick={() => insertBlankPage(lastActivePageIndex)}
          className="flex-1 rounded border border-slate-300 px-1 py-1 text-slate-600 hover:bg-slate-100"
        >
          + Blank
        </button>
        <button
          type="button"
          onClick={() => void importPagesFromFile(lastActivePageIndex)}
          className="flex-1 rounded border border-slate-300 px-1 py-1 text-slate-600 hover:bg-slate-100"
        >
          Import…
        </button>
      </div>

      <div className="flex flex-col gap-2 p-2">
        {visiblePages.map((page) => (
          <div
            key={page.index}
            draggable
            onDragStart={(e) => handleDragStart(e, page.index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, page.index)}
            onClick={() => {
              setLastActivePageIndex(page.index)
              requestScrollToPage(page.index)
            }}
            className={`flex cursor-move flex-col items-center gap-1 rounded p-1 ${
              lastActivePageIndex === page.index ? 'bg-slate-100 ring-1 ring-slate-400' : ''
            }`}
          >
            <ThumbnailCanvas page={page} pdfDoc={pdfDoc} importedPdfDocs={importedPdfDocs} />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => rotatePage(page.index, 'cw')}
                className="h-6 w-6 rounded border border-slate-300 text-xs hover:bg-slate-100"
                aria-label="Rotate page"
              >
                ⟳
              </button>
              <button
                type="button"
                onClick={() => deletePage(page.index)}
                className="h-6 w-6 rounded border border-red-300 text-xs text-red-600 hover:bg-red-50"
                aria-label="Delete page"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
