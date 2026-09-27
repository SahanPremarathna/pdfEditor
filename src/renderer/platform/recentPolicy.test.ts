import { describe, expect, it } from 'vitest'
import { makeDocKey, nameFromKey, sanitizePdfName, selectEvictions } from './recentPolicy'

describe('selectEvictions', () => {
  const entry = (key: string, openedAt: number, storedBytes = 0): { key: string; openedAt: number; storedBytes: number } => ({
    key,
    openedAt,
    storedBytes
  })

  it('keeps everything under both caps', () => {
    expect(selectEvictions([entry('a', 1), entry('b', 2)], 8, 100)).toEqual([])
  })

  it('evicts the oldest past the count cap', () => {
    expect(selectEvictions([entry('a', 1), entry('b', 2), entry('c', 3)], 2, 100)).toEqual(['a'])
  })

  it('evicts older entries that would exceed the byte cap', () => {
    expect(selectEvictions([entry('old', 1, 60), entry('mid', 2, 30), entry('new', 3, 50)], 8, 100)).toEqual(['old'])
  })

  it('never evicts the newest entry even when it alone exceeds the cap', () => {
    expect(selectEvictions([entry('huge', 5, 500), entry('small', 1, 1)], 8, 100)).toEqual(['small'])
  })
})

describe('doc keys', () => {
  it('round-trips the display name', () => {
    expect(nameFromKey(makeDocKey('Report.pdf', 'abc'))).toBe('Report.pdf')
  })

  it('sanitizes path separators and adds a .pdf extension', () => {
    expect(sanitizePdfName('a/b:c')).toBe('a_b_c.pdf')
    expect(sanitizePdfName('  ')).toBe('document.pdf')
    expect(sanitizePdfName('x.PDF')).toBe('x.PDF')
  })
})
