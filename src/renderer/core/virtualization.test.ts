import { describe, expect, it } from 'vitest'
import { getVisibleRange } from './virtualization'

describe('getVisibleRange', () => {
  it('returns an empty range for an empty document', () => {
    expect(getVisibleRange([], 0, 800)).toEqual({ start: 0, end: 0 })
  })

  it('returns an empty range when scrolled past the last page', () => {
    const pageHeights = [500, 500, 500]
    // total content height is 1500; scrolled well past it, no overscan
    expect(getVisibleRange(pageHeights, 10_000, 800, 0)).toEqual({ start: 3, end: 3 })
  })

  it('includes the whole document when overscan margin exceeds total height', () => {
    const pageHeights = [500, 500, 500]
    expect(getVisibleRange(pageHeights, 0, 800, 2)).toEqual({ start: 0, end: 3 })
  })

  it('windows to just the pages intersecting the scroll viewport, with no overscan', () => {
    // pages at [0,500) [500,1000) [1000,1500) [1500,2000) [2000,2500)
    // viewport [600, 1400) intersects pages 1 and 2 only
    const pageHeights = [500, 500, 500, 500, 500]
    expect(getVisibleRange(pageHeights, 600, 800, 0)).toEqual({ start: 1, end: 3 })
  })

  it('expands the window by the overscan margin on both sides', () => {
    const pageHeights = [500, 500, 500, 500, 500]
    // same viewport as above, but with a 1-viewport-height overscan (800px) each side
    expect(getVisibleRange(pageHeights, 600, 800, 1)).toEqual({ start: 0, end: 5 })
  })

  it('handles a single page taller than the viewport', () => {
    expect(getVisibleRange([3000], 1000, 800, 0)).toEqual({ start: 0, end: 1 })
  })
})
