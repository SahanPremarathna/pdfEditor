import { beforeEach, describe, expect, it } from 'vitest'
import { createTextObject } from '../core/objects'
import { useHistoryStore } from '../core/history'
import { useObjectStore } from './objectStore'
import type { PdfObject, TextObject } from '../../shared/types'

const asText = (obj: PdfObject | undefined): TextObject | undefined => obj as TextObject | undefined

const initialState = useObjectStore.getState()
const initialHistoryState = useHistoryStore.getState()

beforeEach(() => {
  useObjectStore.setState(initialState, true)
  useHistoryStore.setState(initialHistoryState, true)
})

function textFixture(id: string, pageIndex: number, z: number, overrides: Record<string, unknown> = {}) {
  return createTextObject(pageIndex, 0, 0, z, overrides, () => id)
}

describe('objectStore', () => {
  it('addObject appends to the right page bucket', () => {
    const obj = textFixture('a', 0, 0)
    useObjectStore.getState().addObject(obj)

    expect(useObjectStore.getState().objectsByPage[0]).toEqual([obj])
  })

  it('updateObject patches the matching object only', () => {
    const a = textFixture('a', 0, 0)
    const b = textFixture('b', 0, 1)
    useObjectStore.getState().addObject(a)
    useObjectStore.getState().addObject(b)

    useObjectStore.getState().updateObject(0, 'a', { text: 'edited' })

    const page0 = useObjectStore.getState().objectsByPage[0]
    expect(asText(page0.find((o) => o.id === 'a'))?.text).toBe('edited')
    expect(asText(page0.find((o) => o.id === 'b'))?.text).toBe('')
  })

  it('updateObject is a no-op on a locked object', () => {
    const locked = textFixture('a', 0, 0, { locked: true })
    useObjectStore.getState().addObject(locked)

    useObjectStore.getState().updateObject(0, 'a', { text: 'should not apply' })

    expect(asText(useObjectStore.getState().objectsByPage[0][0])?.text).toBe('')
  })

  it('removeObject removes the object and re-densifies remaining z values', () => {
    const a = textFixture('a', 0, 0)
    const b = textFixture('b', 0, 1)
    const c = textFixture('c', 0, 2)
    useObjectStore.getState().addObject(a)
    useObjectStore.getState().addObject(b)
    useObjectStore.getState().addObject(c)

    useObjectStore.getState().removeObject(0, 'b')

    const page0 = useObjectStore.getState().objectsByPage[0]
    expect(page0.map((o) => o.id)).toEqual(['a', 'c'])
    expect(page0.map((o) => o.z)).toEqual([0, 1])
  })

  it('removeObject is a no-op on a locked object', () => {
    const locked = textFixture('a', 0, 0, { locked: true })
    useObjectStore.getState().addObject(locked)

    useObjectStore.getState().removeObject(0, 'a')

    expect(useObjectStore.getState().objectsByPage[0]).toHaveLength(1)
  })

  it('removeObject clears selection and active editing when the removed object was selected/being edited', () => {
    const a = textFixture('a', 0, 0)
    useObjectStore.getState().addObject(a)
    useObjectStore.getState().selectObject('a')
    useObjectStore.getState().startEditing('a')

    useObjectStore.getState().removeObject(0, 'a')

    expect(useObjectStore.getState().selectedId).toBeNull()
    expect(useObjectStore.getState().activeEditingId).toBeNull()
  })

  it('removeObject leaves selection untouched when a different object is removed', () => {
    const a = textFixture('a', 0, 0)
    const b = textFixture('b', 0, 1)
    useObjectStore.getState().addObject(a)
    useObjectStore.getState().addObject(b)
    useObjectStore.getState().selectObject('a')

    useObjectStore.getState().removeObject(0, 'b')

    expect(useObjectStore.getState().selectedId).toBe('a')
  })

  it('bringToFront moves the object to the highest z', () => {
    const a = textFixture('a', 0, 0)
    const b = textFixture('b', 0, 1)
    useObjectStore.getState().addObject(a)
    useObjectStore.getState().addObject(b)

    useObjectStore.getState().bringToFront(0, 'a')

    const page0 = useObjectStore.getState().objectsByPage[0]
    expect(page0.find((o) => o.id === 'a')?.z).toBe(1)
    expect(page0.find((o) => o.id === 'b')?.z).toBe(0)
  })
})

describe('objectStore undo/redo', () => {
  it('addObject pushes a history entry that undoes/redoes the add', () => {
    const a = textFixture('a', 0, 0)
    useObjectStore.getState().addObject(a)
    expect(useObjectStore.getState().objectsByPage[0]).toHaveLength(1)

    useHistoryStore.getState().undo()
    expect(useObjectStore.getState().objectsByPage[0] ?? []).toHaveLength(0)

    useHistoryStore.getState().redo()
    expect(useObjectStore.getState().objectsByPage[0]).toHaveLength(1)
  })

  it('updateObject undo restores the previous field value', () => {
    const a = textFixture('a', 0, 0)
    useObjectStore.getState().addObject(a)
    useObjectStore.getState().updateObject(0, 'a', { text: 'edited' })
    expect(asText(useObjectStore.getState().objectsByPage[0][0])?.text).toBe('edited')

    useHistoryStore.getState().undo()
    expect(asText(useObjectStore.getState().objectsByPage[0][0])?.text).toBe('')
  })

  it('removeObject undo brings the object back (selection is not restored)', () => {
    const a = textFixture('a', 0, 0)
    useObjectStore.getState().addObject(a)
    useObjectStore.getState().selectObject('a')
    useObjectStore.getState().removeObject(0, 'a')
    expect(useObjectStore.getState().objectsByPage[0]).toHaveLength(0)
    expect(useObjectStore.getState().selectedId).toBeNull()

    useHistoryStore.getState().undo()

    expect(useObjectStore.getState().objectsByPage[0]).toHaveLength(1)
    // Selection is deliberately excluded from undo — it stays cleared.
    expect(useObjectStore.getState().selectedId).toBeNull()
  })

  it('bringToFront undo restores the previous z order', () => {
    const a = textFixture('a', 0, 0)
    const b = textFixture('b', 0, 1)
    useObjectStore.getState().addObject(a)
    useObjectStore.getState().addObject(b)
    useObjectStore.getState().bringToFront(0, 'a')

    useHistoryStore.getState().undo()

    const page0 = useObjectStore.getState().objectsByPage[0]
    expect(page0.find((o) => o.id === 'a')?.z).toBe(0)
    expect(page0.find((o) => o.id === 'b')?.z).toBe(1)
  })

  it('does not push a history entry for a no-op (locked object, boundary z-order move)', () => {
    const locked = textFixture('a', 0, 0, { locked: true })
    useObjectStore.getState().addObject(locked) // one real entry pushed
    expect(useHistoryStore.getState().undoStack).toHaveLength(1)

    useObjectStore.getState().updateObject(0, 'a', { text: 'nope' })
    useObjectStore.getState().removeObject(0, 'a')
    useObjectStore.getState().bringToFront(0, 'a') // already at front/only object — boundary no-op

    expect(useHistoryStore.getState().undoStack).toHaveLength(1)
  })

  it('selectObject/startEditing/stopEditing never push a history entry', () => {
    const a = textFixture('a', 0, 0)
    useObjectStore.getState().addObject(a)
    expect(useHistoryStore.getState().undoStack).toHaveLength(1)

    useObjectStore.getState().selectObject('a')
    useObjectStore.getState().startEditing('a')
    useObjectStore.getState().stopEditing()

    expect(useHistoryStore.getState().undoStack).toHaveLength(1)
  })

  it('object edits and separate actions interleave on the same shared stack in order', () => {
    const a = textFixture('a', 0, 0)
    const b = textFixture('b', 0, 1)
    useObjectStore.getState().addObject(a)
    useObjectStore.getState().addObject(b)
    useObjectStore.getState().removeObject(0, 'a')

    expect(useHistoryStore.getState().undoStack).toHaveLength(3)

    useHistoryStore.getState().undo() // undoes the remove
    expect(useObjectStore.getState().objectsByPage[0]).toHaveLength(2)
    useHistoryStore.getState().undo() // undoes adding b
    expect(useObjectStore.getState().objectsByPage[0]).toHaveLength(1)
    useHistoryStore.getState().undo() // undoes adding a
    expect(useObjectStore.getState().objectsByPage[0] ?? []).toHaveLength(0)
  })
})
