import { EncryptedPDFError, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { resolveStandardFont, toExportError } from './exportPdf'

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
