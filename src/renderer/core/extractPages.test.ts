import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { exportPdf } from './exportPdf'
import { identityPagesFor } from './exportPdf.testHelpers'
import {
  extractionFileName,
  formatPageRanges,
  pagesForExtraction,
  parsePageSelection,
  visualPageNumbers
} from './extractPages'
import type { PageMeta } from '../../shared/types'

const page = (index: number, deleted = false): PageMeta => ({
  index,
  source: { kind: 'original', sourcePageNumber: index + 1 },
  widthPt: 100,
  heightPt: 100,
  rotation: 0,
  deleted
})

describe('pagesForExtraction', () => {
  it('marks every non-selected page deleted and keeps order', () => {
    const result = pagesForExtraction([page(0), page(1), page(2)], [2, 0])
    expect(result.map((p) => [p.index, p.deleted])).toEqual([
      [0, false],
      [1, true],
      [2, false]
    ])
  })

  it('never resurrects an already-deleted page', () => {
    expect(pagesForExtraction([page(0, true)], [0])[0].deleted).toBe(true)
  })
})

describe('visualPageNumbers', () => {
  it('numbers pages by visible position, skipping deleted ones', () => {
    expect(visualPageNumbers([page(5), page(1, true), page(9)], [9])).toEqual([2])
  })
})

describe('formatPageRanges / extractionFileName', () => {
  it('compresses runs', () => {
    expect(formatPageRanges([5, 1, 2, 3, 8, 7])).toBe('1-3, 5, 7-8')
  })

  it('builds a readable file name', () => {
    expect(extractionFileName('report.pdf', [2, 3])).toBe('report (pages 2-3).pdf')
    expect(extractionFileName('report.PDF', [4])).toBe('report (page 4).pdf')
    expect(extractionFileName(null, [1, 3])).toBe('document (pages 1,3).pdf')
  })
})

describe('parsePageSelection', () => {
  it('parses lists and ranges', () => {
    expect(parsePageSelection('1-3, 5, 8-', 10)).toEqual([1, 2, 3, 5, 8, 9, 10])
    expect(parsePageSelection('-2', 10)).toEqual([1, 2])
    expect(parsePageSelection('3,3,1', 10)).toEqual([1, 3])
  })

  it('rejects malformed or out-of-range input', () => {
    expect(parsePageSelection('', 5)).toBeNull()
    expect(parsePageSelection('0', 5)).toBeNull()
    expect(parsePageSelection('6', 5)).toBeNull()
    expect(parsePageSelection('3-1', 5)).toBeNull()
    expect(parsePageSelection('a', 5)).toBeNull()
  })
})

describe('extraction through exportPdf', () => {
  it('produces a PDF with only the selected pages, in order', async () => {
    const source = await PDFDocument.create()
    source.addPage([100, 100])
    source.addPage([200, 200])
    source.addPage([300, 300])
    const bytes = await source.save()

    const pages = pagesForExtraction(identityPagesFor(source), [0, 2])
    const { bytes: out } = await exportPdf(bytes, {}, pages, {}, [], false, null)
    const result = await PDFDocument.load(out)
    expect(result.getPages().map((p) => p.getSize().width)).toEqual([100, 300])
  })
})
