import { describe, expect, it } from 'vitest'
import { findLaunchPdfPath } from './launchArgs'

describe('findLaunchPdfPath', () => {
  it('finds the path in a packaged app argv shape ([exePath, filePath])', () => {
    expect(findLaunchPdfPath(['C:\\Program Files\\Inkline\\Inkline.exe', 'C:\\Users\\me\\report.pdf'])).toBe(
      'C:\\Users\\me\\report.pdf'
    )
  })

  it('finds the path in a dev/unpackaged argv shape (electron flags + entry script first)', () => {
    const argv = ['C:\\...\\electron.exe', '.', '--inspect', 'C:\\Users\\me\\report.pdf']
    expect(findLaunchPdfPath(argv)).toBe('C:\\Users\\me\\report.pdf')
  })

  it('returns null when no argv entry ends in .pdf', () => {
    expect(findLaunchPdfPath(['C:\\Program Files\\Inkline\\Inkline.exe'])).toBeNull()
  })

  it('matches case-insensitively', () => {
    expect(findLaunchPdfPath(['C:\\Inkline.exe', 'C:\\Users\\me\\REPORT.PDF'])).toBe('C:\\Users\\me\\REPORT.PDF')
  })

  it('ignores flags and paths that merely contain "pdf" without ending in it', () => {
    expect(findLaunchPdfPath(['C:\\Inkline.exe', '--pdf-mode', 'C:\\Users\\me\\pdfnotes.txt'])).toBeNull()
  })

  it('returns null for an empty argv', () => {
    expect(findLaunchPdfPath([])).toBeNull()
  })
})
