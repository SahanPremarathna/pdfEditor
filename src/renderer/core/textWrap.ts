/**
 * Greedy word-wraps `text` to fit within `maxWidthPt`, using `measureWidth`
 * to measure candidate strings (callers pass e.g. `(s) =>
 * font.widthOfTextAtSize(s, fontSize)` — this module stays pdf-lib-free so
 * it's trivially unit-testable with a fake measurer).
 *
 * `\n` is a hard break — each resulting paragraph, including empty ones
 * (blank lines), produces at least one output line. Within a paragraph,
 * whitespace runs collapse to a single space (a documented simplification —
 * fully whitespace-preserving wrapping is out of scope). A single word that
 * alone exceeds `maxWidthPt` is broken by character rather than overflowing.
 */
export function wrapText(text: string, maxWidthPt: number, measureWidth: (s: string) => number): string[] {
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    lines.push(...wrapWords(words, maxWidthPt, measureWidth))
  }

  return lines
}

function wrapWords(words: string[], maxWidthPt: number, measureWidth: (s: string) => number): string[] {
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`
    if (measureWidth(candidate) <= maxWidthPt) {
      current = candidate
      continue
    }

    if (current !== '') {
      lines.push(current)
      current = ''
    }

    if (measureWidth(word) <= maxWidthPt) {
      current = word
    } else {
      lines.push(...breakByCharacter(word, maxWidthPt, measureWidth))
    }
  }

  if (current !== '') lines.push(current)
  return lines
}

/** At least one character is always placed per line (the `chunk !== ''`
 *  guard), so this terminates even if a single glyph alone exceeds
 *  `maxWidthPt` — an edge case MIN_TEXT_WIDTH_PT elsewhere makes rare, not
 *  something this function needs to reject outright. */
function breakByCharacter(word: string, maxWidthPt: number, measureWidth: (s: string) => number): string[] {
  const lines: string[] = []
  let chunk = ''

  for (const char of word) {
    const candidate = chunk + char
    if (chunk !== '' && measureWidth(candidate) > maxWidthPt) {
      lines.push(chunk)
      chunk = char
    } else {
      chunk = candidate
    }
  }

  if (chunk !== '') lines.push(chunk)
  return lines
}
