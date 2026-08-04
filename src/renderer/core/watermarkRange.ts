/**
 * Resolves a 1-indexed "from page N to page M" range (as typed into
 * WatermarkPanel, counted among currently-VISIBLE pages) into the actual
 * SET of stable PageMeta.index values it covers. Resolves by POSITION in
 * `visiblePages`, never by treating the ids themselves as a numeric
 * interval — stable ids are assigned by a monotonic counter and are not
 * contiguous/ordered once pages have been reordered, so `pageIndices` must
 * come from slicing the array, not from id arithmetic.
 *
 * Returns null (caller no-ops, doesn't touch the stored config) when there
 * are no pages to resolve against, or when the range is entirely out of
 * bounds after clamping.
 */
export function resolveWatermarkPageRange(
  visiblePages: { index: number }[],
  from: number,
  to: number
): { pageIndices: number[]; rangeInput: { from: number; to: number } } | null {
  if (visiblePages.length === 0) return null

  const lo = Math.max(1, Math.min(from, to))
  const hi = Math.min(visiblePages.length, Math.max(from, to))
  if (lo > hi) return null

  return {
    pageIndices: visiblePages.slice(lo - 1, hi).map((p) => p.index),
    rangeInput: { from: lo, to: hi }
  }
}
