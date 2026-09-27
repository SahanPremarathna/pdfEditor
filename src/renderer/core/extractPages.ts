import type { PageMeta } from '../../shared/types'

/**
 * The page list exportPdf should see to produce a document containing ONLY
 * `pageIds` (stable PageMeta.index values), in their current visual order.
 * Everything else is marked deleted rather than removed, so exportPdf's
 * existing deleted-page handling (and object/watermark lookups keyed by the
 * same stable ids) apply unchanged.
 */
export function pagesForExtraction(pages: readonly PageMeta[], pageIds: Iterable<number>): PageMeta[] {
  const keep = new Set(pageIds)
  return pages.map((p) => (p.deleted || keep.has(p.index) ? p : { ...p, deleted: true }))
}

/** 1-indexed visual page numbers (deleted pages don't count) for `pageIds`, ascending. */
export function visualPageNumbers(pages: readonly PageMeta[], pageIds: Iterable<number>): number[] {
  const keep = new Set(pageIds)
  const numbers: number[] = []
  pages
    .filter((p) => !p.deleted)
    .forEach((p, i) => {
      if (keep.has(p.index)) numbers.push(i + 1)
    })
  return numbers
}

/** Compresses [1,2,3,5,7,8] to "1-3, 5, 7-8". */
export function formatPageRanges(numbers: readonly number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b)
  const parts: string[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    parts.push(i === j ? String(sorted[i]) : `${sorted[i]}-${sorted[j]}`)
    i = j + 1
  }
  return parts.join(', ')
}

/** "report.pdf" + [2,3] → "report (pages 2-3).pdf" */
export function extractionFileName(fileName: string | null, numbers: readonly number[]): string {
  const base = (fileName ?? 'document.pdf').replace(/\.pdf$/i, '')
  const label = numbers.length === 1 ? `page ${numbers[0]}` : `pages ${formatPageRanges(numbers).replace(/, /g, ',')}`
  return `${base} (${label}).pdf`
}

/**
 * Parses a user-typed page selection such as "1-3, 5, 8-" against
 * `pageCount` visual pages. Returns sorted unique 1-indexed page numbers, or
 * null when the input is malformed or selects nothing.
 */
export function parsePageSelection(input: string, pageCount: number): number[] | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const result = new Set<number>()
  for (const raw of trimmed.split(',')) {
    const part = raw.trim()
    if (!part) continue
    const match = /^(\d*)\s*(-)?\s*(\d*)$/.exec(part)
    if (!match) return null
    const [, fromStr, dash, toStr] = match
    if (!fromStr && !toStr) return null
    const from = fromStr ? Number(fromStr) : 1
    const to = dash ? (toStr ? Number(toStr) : pageCount) : from
    if (from < 1 || to < from || to > pageCount) return null
    for (let n = from; n <= to; n++) result.add(n)
  }
  return result.size > 0 ? [...result].sort((a, b) => a - b) : null
}
