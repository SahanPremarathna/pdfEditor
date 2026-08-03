import { describe, expect, it } from 'vitest'
import { hexToRgbColor } from './colors'

describe('hexToRgbColor', () => {
  it('parses black', () => {
    const c = hexToRgbColor('#000000')
    expect(c.red).toBe(0)
    expect(c.green).toBe(0)
    expect(c.blue).toBe(0)
  })

  it('parses white', () => {
    const c = hexToRgbColor('#ffffff')
    expect(c.red).toBe(1)
    expect(c.green).toBe(1)
    expect(c.blue).toBe(1)
  })

  it('parses a mixed color with correct component ordering', () => {
    const c = hexToRgbColor('#ff0080')
    expect(c.red).toBeCloseTo(1, 9)
    expect(c.green).toBeCloseTo(0, 9)
    expect(c.blue).toBeCloseTo(0x80 / 255, 9)
  })

  it('accepts uppercase hex digits', () => {
    const c = hexToRgbColor('#FF0080')
    expect(c.red).toBeCloseTo(1, 9)
    expect(c.blue).toBeCloseTo(0x80 / 255, 9)
  })

  it('throws on a malformed string', () => {
    expect(() => hexToRgbColor('not-a-color')).toThrow()
    expect(() => hexToRgbColor('#fff')).toThrow()
    expect(() => hexToRgbColor('#gggggg')).toThrow()
    expect(() => hexToRgbColor('000000')).toThrow()
  })
})
