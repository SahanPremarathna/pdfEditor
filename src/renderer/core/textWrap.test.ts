import { describe, expect, it } from 'vitest'
import { wrapText } from './textWrap'

// Deterministic fake measurer: width == character count, so maxWidthPt reads
// directly as "max characters per line" in these tests.
const measureByLength = (s: string): number => s.length

describe('wrapText', () => {
  it('keeps short text on a single line', () => {
    expect(wrapText('hello world', 20, measureByLength)).toEqual(['hello world'])
  })

  it('greedily wraps on whitespace once the width limit is exceeded', () => {
    expect(wrapText('one two three four', 7, measureByLength)).toEqual(['one two', 'three', 'four'])
  })

  it('collapses whitespace runs to a single space', () => {
    expect(wrapText('one   two', 20, measureByLength)).toEqual(['one two'])
  })

  it('treats \\n as a hard break', () => {
    expect(wrapText('one\ntwo', 20, measureByLength)).toEqual(['one', 'two'])
  })

  it('preserves blank lines', () => {
    expect(wrapText('one\n\ntwo', 20, measureByLength)).toEqual(['one', '', 'two'])
  })

  it('preserves a leading/trailing blank line', () => {
    expect(wrapText('\none', 20, measureByLength)).toEqual(['', 'one'])
    expect(wrapText('one\n', 20, measureByLength)).toEqual(['one', ''])
  })

  it('returns a single empty line for empty input', () => {
    expect(wrapText('', 20, measureByLength)).toEqual([''])
  })

  it('breaks a long unbreakable token by character, deterministically', () => {
    expect(wrapText('abcdefghij', 4, measureByLength)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('mixes normal words with one overlong token', () => {
    expect(wrapText('hi abcdefghij bye', 4, measureByLength)).toEqual(['hi', 'abcd', 'efgh', 'ij', 'bye'])
  })

  it('never produces an infinite loop when maxWidthPt is smaller than a single character', () => {
    const result = wrapText('ab', 0, measureByLength)
    expect(result).toEqual(['a', 'b'])
  })
})
