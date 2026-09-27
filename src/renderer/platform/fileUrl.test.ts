import { describe, expect, it } from 'vitest'
import { fileUrlToPath } from './fileUrl'

describe('fileUrlToPath', () => {
  it('handles Windows drive paths with escapes', () => {
    expect(fileUrlToPath(new URL('file:///E:/My%20Apps/out/renderer/fonts/a.ttf'))).toBe('E:/My Apps/out/renderer/fonts/a.ttf')
  })

  it('handles POSIX paths', () => {
    expect(fileUrlToPath(new URL('file:///opt/inkline/fonts/a.ttf'))).toBe('/opt/inkline/fonts/a.ttf')
  })

  it('keeps UNC hosts', () => {
    expect(fileUrlToPath(new URL('file://server/share/a.ttf'))).toBe('//server/share/a.ttf')
  })

  it('rejects non-file URLs', () => {
    expect(() => fileUrlToPath(new URL('https://example.com/a'))).toThrow()
  })
})
