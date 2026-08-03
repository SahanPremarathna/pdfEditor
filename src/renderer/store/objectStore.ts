import { create } from 'zustand'
import type { TextObject } from '../../shared/types'
import { densifyZ, reorderZ, type ZDirection } from '../core/zOrder'

const EMPTY_PAGE: TextObject[] = []

interface ObjectState {
  objectsByPage: Record<number, TextObject[]>
  selectedId: string | null
  activeEditingId: string | null

  addObject: (obj: TextObject) => void
  updateObject: (
    pageIndex: number,
    id: string,
    patch: Partial<Omit<TextObject, 'id' | 'pageIndex' | 'type'>>
  ) => void
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
  objectsByPage: Record<number, TextObject[]>,
  pageIndex: number,
  id: string,
  direction: ZDirection
): Record<number, TextObject[]> {
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
          [pageIndex]: existing.map((o) => (o.id === id ? { ...o, ...patch } : o))
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
export const EMPTY_ARRAY: readonly TextObject[] = EMPTY_PAGE
