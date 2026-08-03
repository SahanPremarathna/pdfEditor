import { describe, expect, it } from 'vitest'
import { fontFamilyToCss, normalizeFontFamily, ON_SCREEN_FONT_FAMILIES } from './fontFamilies'

describe('fontFamilyToCss', () => {
  it('maps every known on-screen family to a non-empty CSS stack', () => {
    for (const family of ON_SCREEN_FONT_FAMILIES) {
      expect(fontFamilyToCss(family).length).toBeGreaterThan(0)
    }
  })

  it('falls back to sans for an unknown key', () => {
    expect(fontFamilyToCss('some-unbundled-family')).toBe(fontFamilyToCss('sans'))
  })

  it('falls back to sans for an empty string', () => {
    expect(fontFamilyToCss('')).toBe(fontFamilyToCss('sans'))
  })
})

describe('normalizeFontFamily', () => {
  it('passes through every known on-screen family unchanged', () => {
    for (const family of ON_SCREEN_FONT_FAMILIES) {
      expect(normalizeFontFamily(family)).toBe(family)
    }
  })

  it('falls back to sans for an unknown key', () => {
    expect(normalizeFontFamily('some-unbundled-family')).toBe('sans')
  })

  it('falls back to sans for an empty string', () => {
    expect(normalizeFontFamily('')).toBe('sans')
  })
})
