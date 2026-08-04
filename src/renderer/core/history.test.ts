import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_HISTORY_ENTRIES, useHistoryStore } from './history'

const initialState = useHistoryStore.getState()

beforeEach(() => {
  useHistoryStore.setState(initialState, true)
})

function fakeEntry() {
  return { undo: vi.fn(), redo: vi.fn() }
}

describe('useHistoryStore', () => {
  it('push records an entry and clears the redo stack', () => {
    const a = fakeEntry()
    useHistoryStore.getState().push(a)
    expect(useHistoryStore.getState().undoStack).toEqual([a])
    expect(useHistoryStore.getState().redoStack).toEqual([])
  })

  it('undo calls .undo() and moves the entry to the redo stack', () => {
    const a = fakeEntry()
    useHistoryStore.getState().push(a)

    useHistoryStore.getState().undo()

    expect(a.undo).toHaveBeenCalledOnce()
    expect(a.redo).not.toHaveBeenCalled()
    expect(useHistoryStore.getState().undoStack).toEqual([])
    expect(useHistoryStore.getState().redoStack).toEqual([a])
  })

  it('redo calls .redo() and moves the entry back to the undo stack', () => {
    const a = fakeEntry()
    useHistoryStore.getState().push(a)
    useHistoryStore.getState().undo()

    useHistoryStore.getState().redo()

    expect(a.redo).toHaveBeenCalledOnce()
    expect(useHistoryStore.getState().undoStack).toEqual([a])
    expect(useHistoryStore.getState().redoStack).toEqual([])
  })

  it('undo/redo on an empty stack is a no-op', () => {
    expect(() => useHistoryStore.getState().undo()).not.toThrow()
    expect(() => useHistoryStore.getState().redo()).not.toThrow()
    expect(useHistoryStore.getState().undoStack).toEqual([])
    expect(useHistoryStore.getState().redoStack).toEqual([])
  })

  it('a new push after an undo clears the redo branch', () => {
    const a = fakeEntry()
    const b = fakeEntry()
    useHistoryStore.getState().push(a)
    useHistoryStore.getState().undo()
    expect(useHistoryStore.getState().redoStack).toEqual([a])

    useHistoryStore.getState().push(b)

    expect(useHistoryStore.getState().undoStack).toEqual([b])
    expect(useHistoryStore.getState().redoStack).toEqual([])
  })

  it('undoes and redoes multiple entries in order', () => {
    const a = fakeEntry()
    const b = fakeEntry()
    useHistoryStore.getState().push(a)
    useHistoryStore.getState().push(b)

    useHistoryStore.getState().undo()
    expect(b.undo).toHaveBeenCalledOnce()
    useHistoryStore.getState().undo()
    expect(a.undo).toHaveBeenCalledOnce()

    useHistoryStore.getState().redo()
    expect(a.redo).toHaveBeenCalledOnce()
    useHistoryStore.getState().redo()
    expect(b.redo).toHaveBeenCalledOnce()
  })

  it('caps the undo stack at MAX_HISTORY_ENTRIES, evicting the oldest', () => {
    const entries = Array.from({ length: MAX_HISTORY_ENTRIES + 5 }, () => fakeEntry())
    for (const entry of entries) useHistoryStore.getState().push(entry)

    const stack = useHistoryStore.getState().undoStack
    expect(stack).toHaveLength(MAX_HISTORY_ENTRIES)
    expect(stack[0]).toBe(entries[5])
    expect(stack[stack.length - 1]).toBe(entries[entries.length - 1])
  })

  it('clear empties both stacks', () => {
    useHistoryStore.getState().push(fakeEntry())
    useHistoryStore.getState().undo()
    useHistoryStore.getState().push(fakeEntry())

    useHistoryStore.getState().clear()

    expect(useHistoryStore.getState().undoStack).toEqual([])
    expect(useHistoryStore.getState().redoStack).toEqual([])
  })
})
