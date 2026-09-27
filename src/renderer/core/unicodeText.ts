import { normalizeFontFamily } from './fontFamilies'

/**
 * pdf-lib's 14 standard fonts only encode WinAnsi (Windows-1252). Text that
 * stays inside it keeps exporting with the standard fonts, exactly as
 * before; anything else (non-Latin scripts, arrows, math symbols, emoji...)
 * switches the whole object to the bundled Noto TTFs so export never throws.
 */

/** The 27 printable characters Windows-1252 puts in 0x80–0x9F. */
const CP1252_HIGH = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'

export function isWinAnsiChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0
  if (code >= 0x20 && code <= 0x7e) return true
  if (code >= 0xa0 && code <= 0xff) return true
  return CP1252_HIGH.includes(ch)
}

/** True when every character of `text` (line breaks excluded — wrapText
 *  splits on them before anything is drawn) can use a standard font. */
export function isWinAnsiEncodable(text: string): boolean {
  for (const ch of text) {
    if (ch === '\n' || ch === '\r') continue
    if (!isWinAnsiChar(ch)) return false
  }
  return true
}

export type Script = 'base' | 'sinhala' | 'tamil'

const ZWNJ = 0x200c
const ZWJ = 0x200d

function scriptOf(code: number): Script | null {
  if (code >= 0x0d80 && code <= 0x0dff) return 'sinhala'
  if (code >= 0x0b80 && code <= 0x0bff) return 'tamil'
  // Zero-width (non-)joiners belong to whichever run they sit in — Sinhala
  // uses ZWJ inside conjuncts like ශ්‍රී.
  if (code === ZWJ || code === ZWNJ) return null
  return 'base'
}

export interface ScriptRun {
  script: Script
  text: string
}

/** Splits `text` into maximal runs that each need one font. */
export function segmentByScript(text: string): ScriptRun[] {
  const runs: ScriptRun[] = []
  for (const ch of text) {
    const script = scriptOf(ch.codePointAt(0) ?? 0) ?? runs[runs.length - 1]?.script ?? 'base'
    const last = runs[runs.length - 1]
    if (last && last.script === script) last.text += ch
    else runs.push({ script, text: ch })
  }
  return runs
}

/** Bundled font files (under public/fonts/). Mono has no italics and the
 *  Indic fonts no italics either — those fall back to the upright cut. */
export function unicodeFontFile(family: string, bold: boolean, italic: boolean, script: Script): string {
  if (script === 'sinhala') return bold ? 'NotoSansSinhala-Bold.ttf' : 'NotoSansSinhala-Regular.ttf'
  if (script === 'tamil') return bold ? 'NotoSansTamil-Bold.ttf' : 'NotoSansTamil-Regular.ttf'

  const normalized = normalizeFontFamily(family)
  if (normalized === 'mono') return bold ? 'NotoSansMono-Bold.ttf' : 'NotoSansMono-Regular.ttf'
  const base = normalized === 'serif' ? 'NotoSerif' : 'NotoSans'
  const style = bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular'
  return `${base}-${style}.ttf`
}

/** Tried in order for characters the script's own font lacks — arrows,
 *  math operators, check marks, dingbats and other symbols. */
export const UNICODE_FALLBACK_FONT_FILES = [
  'NotoSansMath-Regular.ttf',
  'NotoSansSymbols2-Regular.ttf',
  'NotoSansSymbols-Regular.ttf'
]

export interface FontRunAssignment<K> {
  key: K
  text: string
}

/**
 * Assigns every character of `text` to a font and groups consecutive
 * characters that share one. Each character prefers its script's font, then
 * the base font, then `fallbacks` in order; a character nobody covers stays
 * with its preferred font (it renders as that font's missing-glyph box
 * rather than failing the export). Zero-width joiners follow the character
 * before them so shaping sees an unbroken run.
 */
export function assignFontRuns<K>(
  text: string,
  preferred: (script: Script) => K,
  fallbacks: readonly K[],
  hasGlyph: (key: K, codePoint: number) => boolean
): FontRunAssignment<K>[] {
  const runs: FontRunAssignment<K>[] = []
  let lastScript: Script = 'base'
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    const last = runs[runs.length - 1]
    const own = scriptOf(code)
    if (own === null && last) {
      last.text += ch
      continue
    }
    const script: Script = own ?? lastScript
    lastScript = script
    const candidates: K[] =
      script === 'base' ? [preferred('base'), ...fallbacks] : [preferred(script), preferred('base'), ...fallbacks]
    const key = candidates.find((k) => hasGlyph(k, code)) ?? candidates[0]
    if (last && last.key === key) last.text += ch
    else runs.push({ key, text: ch })
  }
  return runs
}

/** True when `text` contains Sinhala or Tamil — the UI flags that these are
 *  exported without complex-script shaping (fontkit does no shaping). */
export function hasComplexScript(text: string): boolean {
  return segmentByScript(text).some((r) => r.script !== 'base')
}
