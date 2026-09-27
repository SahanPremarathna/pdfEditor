import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { assignFontRuns, hasComplexScript, isWinAnsiChar, isWinAnsiEncodable, segmentByScript, unicodeFontFile } from './unicodeText'

describe('isWinAnsiChar', () => {
  it('agrees with pdf-lib Helvetica on every code point in the BMP up to U+2FFF', async () => {
    const doc = await PDFDocument.create()
    const font = doc.embedStandardFont(StandardFonts.Helvetica)
    const mismatches: string[] = []
    for (let code = 0x20; code <= 0x2fff; code++) {
      const ch = String.fromCodePoint(code)
      let pdfLibOk = true
      try {
        font.encodeText(ch)
      } catch {
        pdfLibOk = false
      }
      if (pdfLibOk !== isWinAnsiChar(ch)) mismatches.push(code.toString(16))
    }
    expect(mismatches).toEqual([])
  })
})

describe('isWinAnsiEncodable', () => {
  it('accepts plain Latin text, curly quotes and dashes', () => {
    expect(isWinAnsiEncodable('Hello “world” — café\nline two')).toBe(true)
  })

  it('rejects Sinhala, arrows and emoji', () => {
    expect(isWinAnsiEncodable('ශ්‍රී')).toBe(false)
    expect(isWinAnsiEncodable('a → b')).toBe(false)
    expect(isWinAnsiEncodable('ok 👍')).toBe(false)
  })
})

describe('segmentByScript', () => {
  it('splits mixed Latin/Sinhala/Tamil text into runs', () => {
    expect(segmentByScript('Hi ශ්‍රී and தமிழ்')).toEqual([
      { script: 'base', text: 'Hi ' },
      { script: 'sinhala', text: 'ශ්‍රී' },
      { script: 'base', text: ' and ' },
      { script: 'tamil', text: 'தமிழ்' }
    ])
  })

  it('keeps a zero-width joiner inside the surrounding run', () => {
    const runs = segmentByScript('ශ්‍රී')
    expect(runs).toHaveLength(1)
    expect(runs[0].text).toContain('‍')
  })

  it('returns no runs for empty text', () => {
    expect(segmentByScript('')).toEqual([])
  })
})

describe('unicodeFontFile', () => {
  it('maps family and style to the bundled Noto cut', () => {
    expect(unicodeFontFile('sans', false, false, 'base')).toBe('NotoSans-Regular.ttf')
    expect(unicodeFontFile('serif', true, true, 'base')).toBe('NotoSerif-BoldItalic.ttf')
    expect(unicodeFontFile('mono', false, true, 'base')).toBe('NotoSansMono-Regular.ttf')
    expect(unicodeFontFile('legacy-key', true, false, 'base')).toBe('NotoSans-Bold.ttf')
    expect(unicodeFontFile('serif', true, false, 'sinhala')).toBe('NotoSansSinhala-Bold.ttf')
    expect(unicodeFontFile('mono', false, false, 'tamil')).toBe('NotoSansTamil-Regular.ttf')
  })
})

describe('hasComplexScript', () => {
  it('flags Sinhala/Tamil only', () => {
    expect(hasComplexScript('a → b')).toBe(false)
    expect(hasComplexScript('ආයුබෝවන්')).toBe(true)
  })
})

describe('assignFontRuns', () => {
  const covers: Record<string, string> = { base: 'Hi and', sinhala: 'ශ්රී', math: '→' }
  const has = (key: string, code: number): boolean => (covers[key] ?? '').includes(String.fromCodePoint(code)) || code === 0x20
  const preferred = (script: string): string => (script === 'sinhala' ? 'sinhala' : 'base')

  it('uses the script font, then fallbacks for uncovered symbols', () => {
    expect(assignFontRuns('Hi → ශ්‍රී', preferred, ['math'], has)).toEqual([
      { key: 'base', text: 'Hi ' },
      { key: 'math', text: '→' },
      { key: 'base', text: ' ' },
      { key: 'sinhala', text: 'ශ්‍රී' }
    ])
  })

  it('leaves characters nobody covers with their preferred font', () => {
    expect(assignFontRuns('✓', preferred, ['math'], has)).toEqual([{ key: 'base', text: '✓' }])
  })
})
