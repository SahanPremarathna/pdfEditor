import { describe, expect, it, vi } from 'vitest'

// recentFiles.ts imports `electron` at module scope for its I/O wrappers
// (app.getPath, ipcMain.handle) — neither is reachable from addToRecentList,
// the pure function under test here, but the import still needs to resolve
// under plain Node/vitest (where the real `electron` package isn't usable).
vi.mock('electron', () => ({
  app: { getPath: () => '' },
  ipcMain: { handle: () => {} }
}))

import { addToRecentList } from './recentFiles'

describe('addToRecentList', () => {
  it('adds a new path to the front of the list', () => {
    expect(addToRecentList(['b', 'c'], 'a')).toEqual(['a', 'b', 'c'])
  })

  it('moves an already-present path to the front instead of duplicating it', () => {
    expect(addToRecentList(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
  })

  it('caps the list at max, dropping the oldest entries', () => {
    const current = ['a', 'b', 'c']
    expect(addToRecentList(current, 'd', 3)).toEqual(['d', 'a', 'b'])
  })

  it('starts an empty list with just the new path', () => {
    expect(addToRecentList([], 'a')).toEqual(['a'])
  })
})
