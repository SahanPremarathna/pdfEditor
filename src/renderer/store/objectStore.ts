import { create } from 'zustand'
import type { BaseObject, ImageObject, PdfObject, TextObject } from '../../shared/types'
import { useHistoryStore } from '../core/history'
import { densifyZ, nextZ, reorderZ, type ZDirection } from '../core/zOrder'

const EMPTY_PAGE: PdfObject[] = []
const DUPLICATE_OFFSET_PT = 12

/**
 * `Partial<Omit<PdfObject, ...>>` would only keep BaseObject's shared keys
 * (keyof of a union is the INTERSECTION of each member's keys), losing every
 * type-specific field (text, fill, points, ...). Intersecting a Partial of
 * each member's own extra fields instead has the same problem one level
 * down: PathObject.stroke (string) and ShapeObject.stroke (string | null)
 * share a name with different types, and intersecting two Partials collapses
 * a shared field to the NARROWER common type — silently dropping `null`.
 * Hand-listing every patchable field once, using the union of every type it
 * takes across all four object types, avoids that trap.
 */
export interface PdfObjectPatch extends Partial<BaseObject> {
  text?: string
  fontFamily?: string
  fontSize?: number
  color?: string
  bold?: boolean
  italic?: boolean
  align?: TextObject['align']
  lineHeight?: number
  dataUrl?: string
  mime?: ImageObject['mime']
  points?: number[][]
  fill?: string | null
  stroke?: string | null
  strokeWidth?: number
}

interface ObjectState {
  objectsByPage: Record<number, PdfObject[]>
  selectedId: string | null
  activeEditingId: string | null

  addObject: (obj: PdfObject) => void
  updateObject: (pageIndex: number, id: string, patch: PdfObjectPatch) => void
  removeObject: (pageIndex: number, id: string) => void
  /** Copies an object (offset slightly, on top of its page) and selects the
   *  copy. Returns the new id, or null if `id` doesn't exist. */
  duplicateObject: (id: string) => string | null

  selectObject: (id: string | null) => void
  bringToFront: (pageIndex: number, id: string) => void
  sendToBack: (pageIndex: number, id: string) => void
  bringForward: (pageIndex: number, id: string) => void
  sendBackward: (pageIndex: number, id: string) => void

  startEditing: (id: string) => void
  stopEditing: () => void
}

function applyZOrder(
  objectsByPage: Record<number, PdfObject[]>,
  pageIndex: number,
  id: string,
  direction: ZDirection
): Record<number, PdfObject[]> {
  const objects = objectsByPage[pageIndex] ?? EMPTY_PAGE
  const reordered = reorderZ(objects, id, direction)
  if (reordered === objects) return objectsByPage
  return { ...objectsByPage, [pageIndex]: reordered }
}

/**
 * Commits an `objectsByPage` mutation and records it on the shared, global
 * undo/redo stack (core/history.ts) — shared with documentStore's page ops,
 * so edits and page operations interleave in true chronological order.
 *
 * `after === before` (the existing no-op convention every caller already
 * follows — locked-object guards, z-order boundary guards) skips both the
 * `set` call and the history push, so no-ops never pollute the undo stack.
 * `undo`/`redo` write straight to `useObjectStore.setState`, bypassing the
 * public actions entirely, so replaying history can never recursively push
 * another history entry.
 */
function commitObjectsByPage(
  set: (partial: Partial<ObjectState>) => void,
  before: Record<number, PdfObject[]>,
  after: Record<number, PdfObject[]>,
  extra?: Partial<ObjectState>
): void {
  if (after === before) {
    if (extra) set(extra)
    return
  }
  set({ objectsByPage: after, ...extra })
  useHistoryStore.getState().push({
    undo: () => useObjectStore.setState({ objectsByPage: before }),
    redo: () => useObjectStore.setState({ objectsByPage: after })
  })
}

export const useObjectStore = create<ObjectState>((set, get) => ({
  objectsByPage: {},
  selectedId: null,
  activeEditingId: null,

  addObject: (obj) => {
    const before = get().objectsByPage
    const existing = before[obj.pageIndex] ?? EMPTY_PAGE
    const after = { ...before, [obj.pageIndex]: [...existing, obj] }
    commitObjectsByPage(set, before, after)
  },

  updateObject: (pageIndex, id, patch) => {
    const before = get().objectsByPage
    const existing = before[pageIndex] ?? EMPTY_PAGE
    const target = existing.find((o) => o.id === id)
    if (!target || target.locked) return

    const after = {
      ...before,
      // The merge always preserves `o.type` (patch never includes it), so
      // the result is still a valid member of the original object's own
      // union branch — just not something TS can prove structurally from a
      // widened patch bag, hence the cast.
      [pageIndex]: existing.map((o) => (o.id === id ? ({ ...o, ...patch } as PdfObject) : o))
    }
    commitObjectsByPage(set, before, after)
  },

  removeObject: (pageIndex, id) => {
    const state = get()
    const before = state.objectsByPage
    const existing = before[pageIndex] ?? EMPTY_PAGE
    const target = existing.find((o) => o.id === id)
    if (!target || target.locked) return

    const after = { ...before, [pageIndex]: densifyZ(existing.filter((o) => o.id !== id)) }
    commitObjectsByPage(set, before, after, {
      selectedId: state.selectedId === id ? null : state.selectedId,
      activeEditingId: state.activeEditingId === id ? null : state.activeEditingId
    })
  },

  duplicateObject: (id) => {
    const before = get().objectsByPage
    const source = Object.values(before)
      .flat()
      .find((o) => o.id === id)
    if (!source) return null

    const existing = before[source.pageIndex] ?? EMPTY_PAGE
    const copy: PdfObject = {
      ...source,
      id: crypto.randomUUID(),
      x: source.x + DUPLICATE_OFFSET_PT,
      y: source.y + DUPLICATE_OFFSET_PT,
      z: nextZ(existing),
      locked: false
    }
    const after = { ...before, [source.pageIndex]: [...existing, copy] }
    commitObjectsByPage(set, before, after, { selectedId: copy.id })
    return copy.id
  },

  selectObject: (id) => set({ selectedId: id }),

  bringToFront: (pageIndex, id) => {
    const before = get().objectsByPage
    commitObjectsByPage(set, before, applyZOrder(before, pageIndex, id, 'front'))
  },
  sendToBack: (pageIndex, id) => {
    const before = get().objectsByPage
    commitObjectsByPage(set, before, applyZOrder(before, pageIndex, id, 'back'))
  },
  bringForward: (pageIndex, id) => {
    const before = get().objectsByPage
    commitObjectsByPage(set, before, applyZOrder(before, pageIndex, id, 'forward'))
  },
  sendBackward: (pageIndex, id) => {
    const before = get().objectsByPage
    commitObjectsByPage(set, before, applyZOrder(before, pageIndex, id, 'backward'))
  },

  startEditing: (id) => set({ activeEditingId: id }),
  stopEditing: () => set({ activeEditingId: null })
}))

/** Stable empty-array reference for pages with no objects, so
 *  `useObjectStore(s => s.objectsByPage[pageIndex] ?? EMPTY_ARRAY)` doesn't
 *  create a new reference on every render for pages that have no objects. */
export const EMPTY_ARRAY: readonly PdfObject[] = EMPTY_PAGE
