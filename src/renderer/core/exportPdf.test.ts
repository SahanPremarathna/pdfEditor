import { EncryptedPDFError, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { arrowheadPath, resolveStandardFont, toExportError } from './exportPdf'

function parseLineEndpoints(path: string): { x: number; y: number }[] {
  return [...path.matchAll(/L ([\d.-]+),([\d.-]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
}

describe('resolveStandardFont', () => {
  it('resolves each family/style combination to the matching StandardFonts member', () => {
    expect(resolveStandardFont('sans', false, false)).toBe(StandardFonts.Helvetica)
    expect(resolveStandardFont('sans', true, false)).toBe(StandardFonts.HelveticaBold)
    expect(resolveStandardFont('sans', false, true)).toBe(StandardFonts.HelveticaOblique)
    expect(resolveStandardFont('sans', true, true)).toBe(StandardFonts.HelveticaBoldOblique)

    expect(resolveStandardFont('serif', false, false)).toBe(StandardFonts.TimesRoman)
    expect(resolveStandardFont('serif', true, false)).toBe(StandardFonts.TimesRomanBold)
    expect(resolveStandardFont('serif', false, true)).toBe(StandardFonts.TimesRomanItalic)
    expect(resolveStandardFont('serif', true, true)).toBe(StandardFonts.TimesRomanBoldItalic)

    expect(resolveStandardFont('mono', false, false)).toBe(StandardFonts.Courier)
    expect(resolveStandardFont('mono', true, false)).toBe(StandardFonts.CourierBold)
    expect(resolveStandardFont('mono', false, true)).toBe(StandardFonts.CourierOblique)
    expect(resolveStandardFont('mono', true, true)).toBe(StandardFonts.CourierBoldOblique)
  })

  it('falls back to sans for an unknown family key', () => {
    expect(resolveStandardFont('unknown-family', false, false)).toBe(StandardFonts.Helvetica)
  })
})

describe('arrowheadPath', () => {
  it('returns an empty string when the last stroke has fewer than 2 points', () => {
    expect(arrowheadPath([[5, 5]])).toBe('')
    expect(arrowheadPath([])).toBe('')
  })

  it('produces two wing endpoints exactly sizePt away from the tip', () => {
    const path = arrowheadPath([[0, 0, 10, 0]], 10)
    const wings = parseLineEndpoints(path)
    expect(wings).toHaveLength(2)

    for (const wing of wings) {
      expect(Math.hypot(wing.x - 10, wing.y - 0)).toBeCloseTo(10, 9)
    }
  })

  it('mirrors the two wings symmetrically across the segment direction', () => {
    const path = arrowheadPath([[0, 0, 10, 0]], 10)
    const [left, right] = parseLineEndpoints(path)

    // a horizontal segment's wings should be mirror images across the x-axis
    expect(left.x).toBeCloseTo(right.x, 9)
    expect(left.y).toBeCloseTo(-right.y, 9)
  })

  it('uses only the last stroke direction when multiple strokes are given', () => {
    const path = arrowheadPath(
      [
        [0, 0, 1, 1],
        [0, 0, 10, 0]
      ],
      10
    )
    const wings = parseLineEndpoints(path)
    for (const wing of wings) {
      expect(Math.hypot(wing.x - 10, wing.y - 0)).toBeCloseTo(10, 9)
    }
  })
})

describe('toExportError', () => {
  it('translates EncryptedPDFError into a friendly message', () => {
    const result = toExportError(new EncryptedPDFError())
    expect(result.message).toMatch(/password-protected/i)
  })

  it('passes through other Error instances unchanged', () => {
    const original = new Error('some other failure')
    expect(toExportError(original)).toBe(original)
  })

  it('wraps non-Error throws into a generic Error', () => {
    const result = toExportError('a string throw')
    expect(result).toBeInstanceOf(Error)
  })
})
