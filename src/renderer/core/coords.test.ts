import { describe, expect, it } from 'vitest'
import {
  baselineOriginToTopLeft,
  fromPdfSpace,
  konvaTransformToObjectRect,
  MIN_TEXT_HEIGHT_PT,
  MIN_TEXT_WIDTH_PT,
  normalizeRotation,
  objectRotationToDrawRotation,
  rotatedObjectPoint,
  scalePathPoints,
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

describe('objectRotationToDrawRotation', () => {
  it('negates the object rotation when the page itself is unrotated (the well-known pdf-lib clockwise-needs-negative-degrees fact)', () => {
    expect(objectRotationToDrawRotation(30, 0)).toBe(-30)
    expect(objectRotationToDrawRotation(0, 0)).toBe(0)
  })

  it('is not a no-op for an upright object on a rotated page — the page rotation alone still contributes', () => {
    expect(objectRotationToDrawRotation(0, 90)).toBe(90)
  })

  it('composes both contributions', () => {
    expect(objectRotationToDrawRotation(30, 90)).toBe(60)
  })
})

describe('rotatedObjectPoint', () => {
  it('matches the hand-traced worked example: A4, /Rotate 90, object rotated 30deg', () => {
    const a4CropBox: Rect = { x: 0, y: 0, width: 595.28, height: 841.89 }
    const result = rotatedObjectPoint({ x: 72, y: 72 }, { x: 0, y: 10 }, 30, a4CropBox, 90)
    expect(result.x).toBeCloseTo(80.660, 3)
    expect(result.y).toBeCloseTo(67.0, 3)
  })

  it('reduces to plain textBaselineOrigin when the object has no rotation and the page is unrotated', () => {
    const localOffset = { x: 0, y: 8.4 }
    const result = rotatedObjectPoint({ x: 72, y: 72 }, localOffset, 0, cropBox, 0)
    const expected = textBaselineOrigin({ x: 72, y: 72 }, 8.4, cropBox, 0)
    expect(result.x).toBeCloseTo(expected.x, 9)
    expect(result.y).toBeCloseTo(expected.y, 9)
  })

  it('the box top-left corner itself (localOffset {0,0}) is invariant to object rotation — only page rotation moves it', () => {
    const topLeft = { x: 72, y: 72 }
    const zeroOffset = { x: 0, y: 0 }
    const atRotation0 = rotatedObjectPoint(topLeft, zeroOffset, 0, offsetCropBox, 90)
    const atRotation45 = rotatedObjectPoint(topLeft, zeroOffset, 45, offsetCropBox, 90)
    expect(atRotation45.x).toBeCloseTo(atRotation0.x, 9)
    expect(atRotation45.y).toBeCloseTo(atRotation0.y, 9)
  })

  it('agrees with the equivalent "rotate the offset around top-left in viewport space first" framing', () => {
    // independent formulation: compute the true viewport-space point by rotating
    // localOffset around topLeft using Konva's own (cos,sin,-sin,cos) convention,
    // then map that point through the existing page-rotation-only machinery
    // (textBaselineOrigin with ascentPt=0 acts as a generic viewport-point-to-PDF mapper).
    const topLeft = { x: 72, y: 72 }
    const localOffset = { x: 5, y: 12 }
    const objectRotationDeg = 40
    const rotation: PageRotation = 90

    const rad = (objectRotationDeg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const viewportPoint = {
      x: topLeft.x + localOffset.x * cos - localOffset.y * sin,
      y: topLeft.y + localOffset.x * sin + localOffset.y * cos
    }
    const expected = textBaselineOrigin(viewportPoint, 0, offsetCropBox, rotation)

    const result = rotatedObjectPoint(topLeft, localOffset, objectRotationDeg, offsetCropBox, rotation)
    expect(result.x).toBeCloseTo(expected.x, 9)
    expect(result.y).toBeCloseTo(expected.y, 9)
  })
})

describe('scalePathPoints', () => {
  it('scales x and y coordinates independently across every stroke', () => {
    const points = [
      [0, 0, 10, 20],
      [5, 5, 15, 25]
    ]

    const result = scalePathPoints(points, 2, 3)

    expect(result).toEqual([
      [0, 0, 20, 60],
      [10, 15, 30, 75]
    ])
  })

  it('does not mutate the input arrays', () => {
    const points = [[1, 1, 2, 2]]
    const original = points.map((stroke) => [...stroke])

    scalePathPoints(points, 2, 2)

    expect(points).toEqual(original)
  })

  it('is a no-op at scale 1', () => {
    const points = [[3, 4, 5, 6]]
    expect(scalePathPoints(points, 1, 1)).toEqual(points)
  })
})
