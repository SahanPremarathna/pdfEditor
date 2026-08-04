import type { PDFDocument } from 'pdf-lib'
import type { PageMeta } from '../../shared/types'

/** Builds a 1:1 identity `PageMeta[]` (no deletions/reorders/inserts) that
 *  mirrors a pdf-lib fixture doc's own page count/size — for tests that only
 *  care about object-drawing behavior, not exportPdf's page-ops support. */
export function identityPagesFor(doc: PDFDocument): PageMeta[] {
  return doc.getPages().map((page, i) => {
    const { width, height } = page.getSize()
    return {
      index: i,
      source: { kind: 'original', sourcePageNumber: i + 1 },
      widthPt: width,
      heightPt: height,
      rotation: 0,
      deleted: false
    }
  })
}
