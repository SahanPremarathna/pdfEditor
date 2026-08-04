import { describe, expect, it } from 'vitest'
import { resolveWatermarkPageRange } from './watermarkRange'

describe('resolveWatermarkPageRange', () => {
  it('resolves a simple in-order range', () => {
    const pages = [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }]
    expect(resolveWatermarkPageRange(pages, 2, 3)).toEqual({
      pageIndices: [1, 2],
      rangeInput: { from: 2, to: 3 }
    })
  })

  it('normalizes a reversed from/to input', () => {
    const pages = [{ index: 0 }, { index: 1 }, { index: 2 }]
    expect(resolveWatermarkPageRange(pages, 3, 1)).toEqual({
      pageIndices: [0, 1, 2],
      rangeInput: { from: 1, to: 3 }
    })
  })

  it('clamps out-of-bounds from/to into range', () => {
    const pages = [{ index: 0 }, { index: 1 }, { index: 2 }]
    expect(resolveWatermarkPageRange(pages, -5, 100)).toEqual({
      pageIndices: [0, 1, 2],
      rangeInput: { from: 1, to: 3 }
    })
  })

  it('returns null for an empty page list', () => {
    expect(resolveWatermarkPageRange([], 1, 1)).toBeNull()
  })

  it('returns null when both from/to are entirely past the last page (clamps to an inverted range)', () => {
    const pages = [{ index: 0 }, { index: 1 }, { index: 2 }]
    // lo = max(1, min(100,200)) = 100; hi = min(3, max(100,200)) = 3 -> lo > hi
    expect(resolveWatermarkPageRange(pages, 100, 200)).toBeNull()
  })

  it('a single-page range (from === to) resolves to exactly one page', () => {
    const pages = [{ index: 0 }, { index: 1 }, { index: 2 }]
    expect(resolveWatermarkPageRange(pages, 1, 1)).toEqual({
      pageIndices: [0],
      rangeInput: { from: 1, to: 1 }
    })
  })

  it('resolves by POSITION, not by treating stable ids as a numeric interval', () => {
    // Simulates a reordered document: .index values are out of numeric order
    // relative to visual position.
    const pages = [{ index: 5 }, { index: 0 }, { index: 9 }]
    expect(resolveWatermarkPageRange(pages, 1, 2)).toEqual({
      pageIndices: [5, 0],
      rangeInput: { from: 1, to: 2 }
    })
  })
})
