import { create } from 'zustand'
import type { BaseObject, ImageObject, PdfObject, TextObject } from '../../shared/types'
import { densifyZ, reorderZ, type ZDirection } from '../core/zOrder'

const EMPTY_PAGE: PdfObject[] = []

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

export const useObjectStore = create<ObjectState>((set) => ({
  objectsByPage: {},
  selectedId: null,
  activeEditingId: null,

  addObject: (obj) =>
    set((state) => {
      const existing = state.objectsByPage[obj.pageIndex] ?? EMPTY_PAGE
      return {
        objectsByPage: { ...state.objectsByPage, [obj.pageIndex]: [...existing, obj] }
      }
    }),

  updateObject: (pageIndex, id, patch) =>
    set((state) => {
      const existing = state.objectsByPage[pageIndex] ?? EMPTY_PAGE
      const target = existing.find((o) => o.id === id)
      if (!target || target.locked) return state

      return {
        objectsByPage: {
          ...state.objectsByPage,
          // The merge always preserves `o.type` (patch never includes it),
          // so the result is still a valid member of the original object's
          // own union branch — just not something TS can prove structurally
          // from a widened patch bag, hence the cast.
          [pageIndex]: existing.map((o) => (o.id === id ? ({ ...o, ...patch } as PdfObject) : o))
        }
      }
    }),

  removeObject: (pageIndex, id) =>
    set((state) => {
      const existing = state.objectsByPage[pageIndex] ?? EMPTY_PAGE
      const target = existing.find((o) => o.id === id)
      if (!target || target.locked) return state

      return {
        objectsByPage: {
          ...state.objectsByPage,
          [pageIndex]: densifyZ(existing.filter((o) => o.id !== id))
        },
        selectedId: state.selectedId === id ? null : state.selectedId,
        activeEditingId: state.activeEditingId === id ? null : state.activeEditingId
      }
    }),

  selectObject: (id) => set({ selectedId: id }),

  bringToFront: (pageIndex, id) =>
    set((state) => ({ objectsByPage: applyZOrder(state.objectsByPage, pageIndex, id, 'front') })),
  sendToBack: (pageIndex, id) =>
    set((state) => ({ objectsByPage: applyZOrder(state.objectsByPage, pageIndex, id, 'back') })),
  bringForward: (pageIndex, id) =>
    set((state) => ({ objectsByPage: applyZOrder(state.objectsByPage, pageIndex, id, 'forward') })),
  sendBackward: (pageIndex, id) =>
    set((state) => ({ objectsByPage: applyZOrder(state.objectsByPage, pageIndex, id, 'backward') })),

  startEditing: (id) => set({ activeEditingId: id }),
  stopEditing: () => set({ activeEditingId: null })
}))

/** Stable empty-array reference for pages with no objects, so
 *  `useObjectStore(s => s.objectsByPage[pageIndex] ?? EMPTY_ARRAY)` doesn't
 *  create a new reference on every render for pages that have no objects. */
export const EMPTY_ARRAY: readonly PdfObject[] = EMPTY_PAGE
