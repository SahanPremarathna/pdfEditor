import { describe, expect, it } from 'vitest'
import {
  baselineOriginToTopLeft,
  fromPdfSpace,
  konvaTransformToObjectRect,
  MIN_TEXT_HEIGHT_PT,
  MIN_TEXT_WIDTH_PT,
  normalizeRotation,
  type KonvaTransformSnapshot,
  type PageRotation,
  ptToPx,
  pxToPt,
  rawPointToViewport,
  textBaselineOrigin,
  toPdfSpace,
  viewportPointToRaw,
  viewportSize
} from './coords'
import type { Rect } from '../../shared/types'

const ALL_ROTATIONS: PageRotation[] = [0, 90, 180, 270]

// non-square so a width/height swap bug can't hide behind a square fixture
const cropBox: Rect = { x: 0, y: 0, width: 400, height: 900 }
const offsetCropBox: Rect = { x: 30, y: 40, width: 400, height: 900 }

describe('pxToPt / ptToPx', () => {
  it('converts known values at scale 1', () => {
    expect(pxToPt(96, 1)).toBe(96)
    expect(ptToPx(96, 1)).toBe(96)
  })

  it('converts known values at a non-1 scale', () => {
    expect(pxToPt(150, 1.5)).toBe(100)
    expect(ptToPx(100, 1.5)).toBe(150)
  })

  it('are exact inverses across a range of scales', () => {
    for (const scale of [0.25, 1, 1.33, 2, 4]) {
      expect(ptToPx(pxToPt(123.456, scale), scale)).toBeCloseTo(123.456, 10)
    }
  })
})

describe('normalizeRotation', () => {
  it('passes through the four legal values', () => {
    expect(normalizeRotation(0)).toBe(0)
    expect(normalizeRotation(90)).toBe(90)
    expect(normalizeRotation(180)).toBe(180)
    expect(normalizeRotation(270)).toBe(270)
  })

  it('normalizes angles outside [0, 360)', () => {
    expect(normalizeRotation(450)).toBe(90)
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(-360)).toBe(0)
  })

  it('throws on angles that are not a multiple of 90', () => {
    expect(() => normalizeRotation(45)).toThrow()
  })
})

describe('viewportSize', () => {
  it('keeps dimensions for rotation 0 and 180', () => {
    expect(viewportSize(cropBox, 0)).toEqual({ width: 400, height: 900 })
    expect(viewportSize(cropBox, 180)).toEqual({ width: 400, height: 900 })
  })

  it('swaps dimensions for rotation 90 and 270', () => {
    expect(viewportSize(cropBox, 90)).toEqual({ width: 900, height: 400 })
    expect(viewportSize(cropBox, 270)).toEqual({ width: 900, height: 400 })
  })
})

describe('viewportPointToRaw', () => {
  // hand-computed against the corner-mapping table, W=400 H=900
  it('rotation 0: identity', () => {
    expect(viewportPointToRaw({ x: 50, y: 70 }, cropBox, 0)).toEqual({ x: 50, y: 70 })
  })

  it('rotation 90', () => {
    expect(viewportPointToRaw({ x: 50, y: 70 }, cropBox, 90)).toEqual({ x: 70, y: 850 })
  })

  it('rotation 180', () => {
    expect(viewportPointToRaw({ x: 50, y: 70 }, cropBox, 180)).toEqual({ x: 350, y: 830 })
  })

  it('rotation 270', () => {
    expect(viewportPointToRaw({ x: 50, y: 70 }, cropBox, 270)).toEqual({ x: 330, y: 50 })
  })
})

describe('rawPointToViewport is the exact inverse of viewportPointToRaw', () => {
  const samplePoints = [
    { x: 0, y: 0 },
    { x: 50, y: 70 },
    { x: 400, y: 900 },
    { x: 123.4, y: 567.8 }
  ]

  for (const rotation of ALL_ROTATIONS) {
    it(`round-trips at rotation ${rotation}`, () => {
      for (const p of samplePoints) {
        const raw = viewportPointToRaw(p, cropBox, rotation)
        const back = rawPointToViewport(raw, cropBox, rotation)
        expect(back.x).toBeCloseTo(p.x, 9)
        expect(back.y).toBeCloseTo(p.y, 9)
      }
    })
  }
})

describe('toPdfSpace', () => {
  it('computes the bottom-left PDF point for a rotation-0 rect with a zero-origin CropBox', () => {
    // top-left (72,72), 100x20 box, page height 900 -> bottom edge is 92 from top,
    // i.e. 900 - 92 = 808 from the bottom.
    const rect: Rect = { x: 72, y: 72, width: 100, height: 20 }
    expect(toPdfSpace(rect, cropBox, 0)).toEqual({ x: 72, y: 808 })
  })

  it('accounts for a nonzero CropBox origin (CropBox != MediaBox shape)', () => {
    const rect: Rect = { x: 72, y: 72, width: 100, height: 20 }
    // same as above, but the whole page is offset by (30,40)
    expect(toPdfSpace(rect, offsetCropBox, 0)).toEqual({ x: 102, y: 848 })
  })

  for (const rotation of ALL_ROTATIONS) {
    it(`round-trips with fromPdfSpace at rotation ${rotation}`, () => {
      const rect: Rect = { x: 72, y: 72, width: 100, height: 20 }
      const pdfPoint = toPdfSpace(rect, offsetCropBox, rotation)
      const back = fromPdfSpace(pdfPoint, { width: rect.width, height: rect.height }, offsetCropBox, rotation)
      expect(back.x).toBeCloseTo(rect.x, 9)
      expect(back.y).toBeCloseTo(rect.y, 9)
    })
  }
})

describe('textBaselineOrigin', () => {
  it('matches pageHeight - yTop - ascent for a zero-origin CropBox at rotation 0', () => {
    const origin = textBaselineOrigin({ x: 72, y: 72 }, 8.4, cropBox, 0)
    expect(origin).toEqual({ x: 72, y: cropBox.height - 72 - 8.4 })
  })

  it('accounts for a nonzero CropBox origin', () => {
    const origin = textBaselineOrigin({ x: 72, y: 72 }, 8.4, offsetCropBox, 0)
    expect(origin.x).toBeCloseTo(offsetCropBox.x + 72, 9)
    expect(origin.y).toBeCloseTo(offsetCropBox.y + offsetCropBox.height - 72 - 8.4, 9)
  })

  for (const rotation of ALL_ROTATIONS) {
    it(`round-trips with baselineOriginToTopLeft at rotation ${rotation}`, () => {
      const topLeft = { x: 72, y: 72 }
      const ascentPt = 8.4
      const baseline = textBaselineOrigin(topLeft, ascentPt, offsetCropBox, rotation)
      const back = baselineOriginToTopLeft(baseline, ascentPt, offsetCropBox, rotation)
      expect(back.x).toBeCloseTo(topLeft.x, 9)
      expect(back.y).toBeCloseTo(topLeft.y, 9)
    })
  }
})

describe('konvaTransformToObjectRect', () => {
  const baseSnapshot: KonvaTransformSnapshot = {
    x: 144,
    y: 288,
    width: 200,
    height: 40,
    scaleX: 1,
    scaleY: 1,
    rotation: 0
  }

  it('converts position/size to points at scale 1 with no resize', () => {
    const result = konvaTransformToObjectRect(baseSnapshot, 1)
    expect(result).toEqual({ x: 144, y: 288, width: 200, height: 40, rotation: 0 })
  })

  it('converts position/size to points at a non-1 scale', () => {
    const result = konvaTransformToObjectRect(baseSnapshot, 2)
    expect(result).toEqual({ x: 72, y: 144, width: 100, height: 20, rotation: 0 })
  })

  it('bakes scaleX/scaleY into the resulting width/height', () => {
    const resized: KonvaTransformSnapshot = { ...baseSnapshot, scaleX: 1.5, scaleY: 2 }
    const result = konvaTransformToObjectRect(resized, 1)
    expect(result.width).toBeCloseTo(300, 9)
    expect(result.height).toBeCloseTo(80, 9)
  })

  it('passes rotation through unchanged, no unit conversion', () => {
    const rotated: KonvaTransformSnapshot = { ...baseSnapshot, rotation: 37.5 }
    expect(konvaTransformToObjectRect(rotated, 1).rotation).toBe(37.5)
  })

  it('clamps width to MIN_TEXT_WIDTH_PT on a degenerate shrink', () => {
    const tiny: KonvaTransformSnapshot = { ...baseSnapshot, scaleX: 0.001 }
    expect(konvaTransformToObjectRect(tiny, 1).width).toBe(MIN_TEXT_WIDTH_PT)
  })

  it('clamps height to MIN_TEXT_HEIGHT_PT on a degenerate shrink', () => {
    const tiny: KonvaTransformSnapshot = { ...baseSnapshot, scaleY: 0.001 }
    expect(konvaTransformToObjectRect(tiny, 1).height).toBe(MIN_TEXT_HEIGHT_PT)
  })

  it('clamps on a negative scale (flipped resize)', () => {
    const flipped: KonvaTransformSnapshot = { ...baseSnapshot, scaleX: -1, scaleY: -1 }
    const result = konvaTransformToObjectRect(flipped, 1)
    expect(result.width).toBe(MIN_TEXT_WIDTH_PT)
    expect(result.height).toBe(MIN_TEXT_HEIGHT_PT)
  })
})
