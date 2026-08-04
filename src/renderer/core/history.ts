import { create } from 'zustand'

export interface HistoryEntry {
  undo: () => void
  redo: () => void
}

export const MAX_HISTORY_ENTRIES = 100

interface HistoryState {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  push: (entry: HistoryEntry) => void
  undo: () => void
  redo: () => void
  clear: () => void
}

/**
 * A single shared, global undo/redo stack. Every mutating store (objectStore,
 * documentStore's page ops) pushes onto this same stack rather than keeping
 * its own, so operations of different kinds interleave in true chronological
 * order — undo always reverts whatever happened most recently, regardless of
 * which store it came from.
 *
 * Deliberately just the stack, not a generic cross-store "mutate" helper:
 * each store already builds its own before/after snapshot in whatever shape
 * fits it, so the only shared piece is "record how to undo/redo this".
 */
export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],

  push: (entry) =>
    set((state) => ({
      undoStack: [...state.undoStack, entry].slice(-MAX_HISTORY_ENTRIES),
      redoStack: []
    })),

  undo: () => {
    const { undoStack, redoStack } = get()
    const entry = undoStack[undoStack.length - 1]
    if (!entry) return
    entry.undo()
    set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, entry] })
  },

  redo: () => {
    const { undoStack, redoStack } = get()
    const entry = redoStack[redoStack.length - 1]
    if (!entry) return
    entry.redo()
    set({ redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, entry] })
  },

  clear: () => set({ undoStack: [], redoStack: [] })
}))

export const selectCanUndo = (s: HistoryState): boolean => s.undoStack.length > 0
export const selectCanRedo = (s: HistoryState): boolean => s.redoStack.length > 0
