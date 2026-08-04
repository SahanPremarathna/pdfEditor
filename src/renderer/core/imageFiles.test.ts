import { describe, expect, it } from 'vitest'
import { fitWithinMaxDimension } from './imageFiles'

describe('fitWithinMaxDimension', () => {
  it('leaves a size already within the max dimension untouched', () => {
    expect(fitWithinMaxDimension(100, 50, 300)).toEqual({ width: 100, height: 50 })
  })

  it('downscales a landscape image, preserving aspect ratio', () => {
    const result = fitWithinMaxDimension(1000, 500, 300)
    expect(result.width).toBe(300)
    expect(result.height).toBeCloseTo(150, 9)
  })

  it('downscales a portrait image, preserving aspect ratio', () => {
    const result = fitWithinMaxDimension(500, 1000, 300)
    expect(result.height).toBe(300)
    expect(result.width).toBeCloseTo(150, 9)
  })

  it('never upscales a small image', () => {
    expect(fitWithinMaxDimension(50, 20, 300)).toEqual({ width: 50, height: 20 })
  })

  it('falls back to a square of the max dimension for a degenerate zero-size input', () => {
    expect(fitWithinMaxDimension(0, 0, 300)).toEqual({ width: 300, height: 300 })
  })
})
