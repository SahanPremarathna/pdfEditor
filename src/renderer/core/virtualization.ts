export interface VisibleRange {
  /** first visible-or-overscanned page index, inclusive */
  start: number
  /** last visible-or-overscanned page index, exclusive */
  end: number
}

/**
 * Given the CSS-px height of every page (in document order, gaps included by
 * the caller if any), and the current scroll window, returns the [start, end)
 * page-index range that should be actually rendered (visible pages plus an
 * `overscanViewports`-sized margin above and below). Everything outside this
 * range gets a placeholder box instead of a real pdf.js render.
 */
export function getVisibleRange(
  pageHeights: number[],
  scrollTop: number,
  viewportHeight: number,
  overscanViewports = 2
): VisibleRange {
  if (pageHeights.length === 0) return { start: 0, end: 0 }

  const margin = viewportHeight * overscanViewports
  const rangeTop = scrollTop - margin
  const rangeBottom = scrollTop + viewportHeight + margin

  let start = 0
  let offset = 0
  for (; start < pageHeights.length; start++) {
    const nextOffset = offset + pageHeights[start]
    if (nextOffset > rangeTop) break
    offset = nextOffset
  }

  let end = start
  for (; end < pageHeights.length; end++) {
    if (offset >= rangeBottom) break
    offset += pageHeights[end]
  }

  return { start, end }
}

/**
 * Index of the page under the "reading line" `probeOffset` px from the top of
 * the content — the page a reader would call current. Pages are laid out
 * back to back from 0 using `pageHeights` (gaps included by the caller).
 * Clamps to the first/last page when the probe falls outside the content.
 */
export function pageAtOffset(pageHeights: number[], probeOffset: number): number {
  if (pageHeights.length === 0) return -1
  let offset = 0
  for (let i = 0; i < pageHeights.length; i++) {
    offset += pageHeights[i]
    if (probeOffset < offset) return i
  }
  return pageHeights.length - 1
}

/** Top offset (px) of page `index` in a back-to-back layout of `pageHeights`. */
export function offsetOfPage(pageHeights: number[], index: number): number {
  let offset = 0
  for (let i = 0; i < index && i < pageHeights.length; i++) offset += pageHeights[i]
  return offset
}
