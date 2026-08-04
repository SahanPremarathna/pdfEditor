import { describe, expect, it } from 'vitest'
import { resolvePageSource } from './pageSources'
import type { PDFDocumentProxy } from './renderPdf'
import type { PageMeta } from '../../shared/types'

const fakeDoc = (label: string): PDFDocumentProxy => ({ label }) as unknown as PDFDocumentProxy

function basePage(overrides: Partial<PageMeta> = {}): PageMeta {
  return {
    index: 0,
    source: { kind: 'original', sourcePageNumber: 1 },
    widthPt: 612,
    heightPt: 792,
    rotation: 0,
    deleted: false,
    ...overrides
  }
}

describe('resolvePageSource', () => {
  it('resolves an original page to the main pdfDoc at its source page number', () => {
    const mainDoc = fakeDoc('main')
    const page = basePage({ source: { kind: 'original', sourcePageNumber: 3 }, rotation: 90 })

    const resolved = resolvePageSource(page, mainDoc, {})

    expect(resolved).toEqual({ kind: 'renderable', pdfDoc: mainDoc, pageNumber: 3, rotationDeg: 90 })
  })

  it('resolves an imported page to the matching imported doc', () => {
    const mainDoc = fakeDoc('main')
    const importedDoc = fakeDoc('imported-a')
    const page = basePage({ source: { kind: 'imported', importId: 'a', sourcePageNumber: 2 } })

    const resolved = resolvePageSource(page, mainDoc, { a: importedDoc })

    expect(resolved).toEqual({ kind: 'renderable', pdfDoc: importedDoc, pageNumber: 2, rotationDeg: 0 })
  })

  it('resolves a blank page with no pdfDoc/pageNumber at all', () => {
    const page = basePage({ source: { kind: 'blank' } })

    expect(resolvePageSource(page, fakeDoc('main'), {})).toEqual({ kind: 'blank' })
  })
})
