import type { PageRotation } from './coords'
import type { PDFDocumentProxy } from './renderPdf'
import type { PageMeta } from '../../shared/types'

export type ResolvedPageSource =
  | { kind: 'renderable'; pdfDoc: PDFDocumentProxy; pageNumber: number; rotationDeg: PageRotation }
  | { kind: 'blank' }

/**
 * Dispatches a PageMeta's `source` to the concrete pdfjs doc + page number it
 * should render from, or signals that it has no pdfjs source at all (a
 * blank inserted page). Pure — no React/store imports — so it's testable
 * against fake PDFDocumentProxy stand-ins without touching real pdf.js.
 */
export function resolvePageSource(
  page: PageMeta,
  originalPdfDoc: PDFDocumentProxy,
  importedDocs: Record<string, PDFDocumentProxy>
): ResolvedPageSource {
  if (page.source.kind === 'blank') return { kind: 'blank' }

  const pdfDoc = page.source.kind === 'original' ? originalPdfDoc : importedDocs[page.source.importId]
  return { kind: 'renderable', pdfDoc, pageNumber: page.source.sourcePageNumber, rotationDeg: page.rotation }
}
