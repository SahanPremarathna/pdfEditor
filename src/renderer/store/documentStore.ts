import { create } from 'zustand'
import { normalizeRotation } from '../core/coords'
import { exportPdf } from '../core/exportPdf'
import { readFormFields } from '../core/formFields'
import { useHistoryStore } from '../core/history'
import { getPageSize, loadDocument, type PDFDocumentProxy } from '../core/renderPdf'
import { useFormStore } from './formStore'
import { useObjectStore } from './objectStore'
import { useUiStore } from './uiStore'
import { useWatermarkStore } from './watermarkStore'
import type { PageMeta } from '../../shared/types'

const DEFAULT_PAGE_WIDTH_PT = 612 // US Letter, used only when inserting a blank page into an empty document
const DEFAULT_PAGE_HEIGHT_PT = 792

interface ImportedDoc {
  pdfDoc: PDFDocumentProxy
  bytes: Uint8Array
}

interface DocumentState {
  fileName: string | null
  absolutePath: string | null
  originalBytes: Uint8Array | null
  pdfDoc: PDFDocumentProxy | null
  pages: PageMeta[]
  /** Source docs for `{kind:'imported'}` pages, keyed by importId — cached
   *  for the lifetime of the open document, never evicted (consistent with
   *  the app already holding the whole current doc in memory). */
  importedDocs: Record<string, ImportedDoc>
  /** Monotonic counter for PageMeta.index on new (blank/imported) pages.
   *  Never rolled back by undo — ids are burned permanently so the undo and
   *  redo branches can never collide on the same id. */
  nextPageId: number
  isLoading: boolean
  isSaving: boolean
  isDirty: boolean
  error: string | null
  /** A dismissible, non-error informational message (e.g. "saved with forms
   *  flattened") — separate from `error` so the two never stomp each other. */
  notice: string | null
  openFile: () => Promise<void>
  openPath: (path: string) => Promise<void>
  save: () => Promise<void>
  saveAs: () => Promise<void>
  markDirty: () => void
  clearError: () => void
  clearNotice: () => void

  rotatePage: (pageId: number, direction: 'cw' | 'ccw') => void
  deletePage: (pageId: number) => void
  reorderPages: (draggedPageId: number, targetPageId: number) => void
  insertBlankPage: (afterPageId: number | null, size?: { widthPt: number; heightPt: number }) => void
  importPagesFromFile: (afterPageId: number | null) => Promise<void>
}

/**
 * Commits a `pages` mutation and records it on the shared, global undo/redo
 * stack (core/history.ts) — the same stack objectStore pushes onto, so page
 * operations and object edits interleave in true chronological order.
 * `pages` and the dirty flag live in the same store, so this can mark dirty
 * directly rather than needing a cross-store subscription the way
 * objectStore's edits do.
 */
function commitPages(set: (partial: Partial<DocumentState>) => void, before: PageMeta[], after: PageMeta[]): void {
  if (after === before) return
  set({ pages: after, isDirty: true })
  window.api.notifyDirty(true)
  useHistoryStore.getState().push({
    undo: () => useDocumentStore.setState({ pages: before }),
    redo: () => useDocumentStore.setState({ pages: after })
  })
}

/**
 * Shared by `openFile` (dialog-picked) and `openPath` (a known path, e.g.
 * from the recent-files list or the native menu's Open Recent submenu) —
 * everything after "bytes for the file at `path` are known" is identical.
 * Clears undo history and form fields from whatever was open before (they'd
 * otherwise reference a document that's no longer open), loads the new
 * pdf.js doc, builds an identity `pages` list, and non-fatally reads any
 * AcroForm fields (a read failure must never block opening the document).
 */
async function finishOpening(set: (partial: Partial<DocumentState>) => void, path: string, bytes: Uint8Array): Promise<void> {
  useHistoryStore.getState().clear()
  useFormStore.getState().reset()
  useWatermarkStore.getState().reset()

  // pdf.js transfers this buffer to its worker thread (a Transferable, for
  // performance), which DETACHES it in the main thread — keep an
  // independent copy for exportPdf's later use, or originalBytes would
  // silently become a zero-length buffer the moment the PDF renders.
  const originalBytes = bytes.slice()

  const pdfDoc = await loadDocument(bytes)
  const pages: PageMeta[] = []
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const { width, height } = await getPageSize(pdfDoc, i)
    pages.push({
      index: i - 1,
      source: { kind: 'original', sourcePageNumber: i },
      widthPt: width,
      heightPt: height,
      rotation: 0,
      deleted: false
    })
  }

  const fileName = path.split(/[/\\]/).pop() ?? path
  set({
    fileName,
    absolutePath: path,
    originalBytes,
    pdfDoc,
    pages,
    importedDocs: {},
    nextPageId: pdfDoc.numPages,
    isLoading: false,
    isDirty: false
  })
  window.api.notifyDirty(false)

  try {
    useFormStore.getState().setFields(await readFormFields(originalBytes))
  } catch {
    // No AcroForm, or unreadable — leave fields empty. Never blocks opening.
  }
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  fileName: null,
  absolutePath: null,
  originalBytes: null,
  pdfDoc: null,
  pages: [],
  importedDocs: {},
  nextPageId: 0,
  isLoading: false,
  isSaving: false,
  isDirty: false,
  error: null,
  notice: null,

  openFile: async () => {
    set({ isLoading: true, error: null, notice: null })
    try {
      const result = await window.api.openDialog()
      if (!result) {
        set({ isLoading: false })
        return
      }
      await finishOpening(set, result.path, result.bytes)
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to open PDF' })
    }
  },

  openPath: async (path) => {
    set({ isLoading: true, error: null, notice: null })
    try {
      const bytes = await window.api.readFile(path)
      await finishOpening(set, path, bytes)
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to open PDF' })
    }
  },

  save: async () => {
    const { originalBytes, absolutePath, pages, importedDocs } = get()
    if (!originalBytes) return
    if (!absolutePath) {
      await get().saveAs()
      return
    }

    set({ isSaving: true, error: null, notice: null })
    try {
      const importedSources = Object.fromEntries(Object.entries(importedDocs).map(([id, doc]) => [id, doc.bytes]))
      const { bytes, forcedFlatten } = await exportPdf(
        originalBytes,
        useObjectStore.getState().objectsByPage,
        pages,
        importedSources,
        useFormStore.getState().fields,
        useUiStore.getState().flattenOnExport,
        useWatermarkStore.getState().config
      )
      await window.api.save(absolutePath, bytes)
      set({ isSaving: false, isDirty: false, notice: forcedFlattenNotice(forcedFlatten) })
      window.api.notifyDirty(false)
    } catch (err) {
      set({ isSaving: false, error: err instanceof Error ? err.message : 'Failed to save' })
    }
  },

  saveAs: async () => {
    const { originalBytes, fileName, pages, importedDocs } = get()
    if (!originalBytes) return

    set({ isSaving: true, error: null, notice: null })
    try {
      const importedSources = Object.fromEntries(Object.entries(importedDocs).map(([id, doc]) => [id, doc.bytes]))
      const { bytes, forcedFlatten } = await exportPdf(
        originalBytes,
        useObjectStore.getState().objectsByPage,
        pages,
        importedSources,
        useFormStore.getState().fields,
        useUiStore.getState().flattenOnExport,
        useWatermarkStore.getState().config
      )
      const chosenPath = await window.api.saveAs(fileName ?? 'document.pdf', bytes)
      if (chosenPath) {
        set({
          absolutePath: chosenPath,
          fileName: chosenPath.split(/[/\\]/).pop() ?? chosenPath,
          isSaving: false,
          isDirty: false,
          notice: forcedFlattenNotice(forcedFlatten)
        })
        window.api.notifyDirty(false)
      } else {
        set({ isSaving: false })
      }
    } catch (err) {
      set({ isSaving: false, error: err instanceof Error ? err.message : 'Failed to save' })
    }
  },

  markDirty: () => set({ isDirty: true }),
  clearError: () => set({ error: null }),
  clearNotice: () => set({ notice: null }),

  rotatePage: (pageId, direction) => {
    const before = get().pages
    const idx = before.findIndex((p) => p.index === pageId)
    if (idx === -1) return

    const page = before[idx]
    const delta = direction === 'cw' ? 90 : -90
    const updated: PageMeta = {
      ...page,
      rotation: normalizeRotation(page.rotation + delta),
      widthPt: page.heightPt,
      heightPt: page.widthPt
    }
    const after = before.map((p, i) => (i === idx ? updated : p))
    commitPages(set, before, after)
  },

  deletePage: (pageId) => {
    const before = get().pages
    const idx = before.findIndex((p) => p.index === pageId)
    if (idx === -1 || before[idx].deleted) return

    const after = before.map((p, i) => (i === idx ? { ...p, deleted: true } : p))
    commitPages(set, before, after)
  },

  reorderPages: (draggedPageId, targetPageId) => {
    const before = get().pages
    const fromIdx = before.findIndex((p) => p.index === draggedPageId)
    if (fromIdx === -1 || draggedPageId === targetPageId) return

    const after = [...before]
    const [moved] = after.splice(fromIdx, 1)
    // Recomputed AFTER removing the dragged page, since removal shifts every
    // subsequent index — looking this up by id (not raw position) also
    // avoids any mismatch with a caller that's only looking at the
    // deleted-filtered, on-screen ordering.
    const insertAt = after.findIndex((p) => p.index === targetPageId)
    if (insertAt === -1) return
    after.splice(insertAt, 0, moved)
    commitPages(set, before, after)
  },

  insertBlankPage: (afterPageId, size) => {
    const state = get()
    const before = state.pages
    const afterIdx = afterPageId === null ? -1 : before.findIndex((p) => p.index === afterPageId)
    const reference = afterIdx !== -1 ? before[afterIdx] : before[before.length - 1]

    const newPage: PageMeta = {
      index: state.nextPageId,
      source: { kind: 'blank' },
      widthPt: size?.widthPt ?? reference?.widthPt ?? DEFAULT_PAGE_WIDTH_PT,
      heightPt: size?.heightPt ?? reference?.heightPt ?? DEFAULT_PAGE_HEIGHT_PT,
      rotation: 0,
      deleted: false
    }
    const insertAt = afterIdx !== -1 ? afterIdx + 1 : before.length
    const after = [...before.slice(0, insertAt), newPage, ...before.slice(insertAt)]

    set({ nextPageId: state.nextPageId + 1 })
    commitPages(set, before, after)
  },

  importPagesFromFile: async (afterPageId) => {
    const result = await window.api.openDialog()
    if (!result) return

    // Same detach concern as openFile's originalBytes — keep an independent
    // copy before loadDocument transfers the original to pdf.js's worker.
    const bytes = result.bytes.slice()
    let pdfDoc: PDFDocumentProxy
    try {
      pdfDoc = await loadDocument(result.bytes)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to import PDF' })
      return
    }
    const importId = crypto.randomUUID()

    const state = get()
    const before = state.pages
    const afterIdx = afterPageId === null ? -1 : before.findIndex((p) => p.index === afterPageId)
    const insertAt = afterIdx !== -1 ? afterIdx + 1 : before.length

    const newPages: PageMeta[] = []
    let nextId = state.nextPageId
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const { width, height } = await getPageSize(pdfDoc, i)
      newPages.push({
        index: nextId++,
        source: { kind: 'imported', importId, sourcePageNumber: i },
        widthPt: width,
        heightPt: height,
        rotation: 0,
        deleted: false
      })
    }
    const after = [...before.slice(0, insertAt), ...newPages, ...before.slice(insertAt)]

    set((s) => ({ nextPageId: nextId, importedDocs: { ...s.importedDocs, [importId]: { pdfDoc, bytes } } }))
    commitPages(set, before, after)
  }
}))

function forcedFlattenNotice(forcedFlatten: boolean): string | null {
  return forcedFlatten
    ? "Saved with form fields flattened — this document had page changes, so its form couldn't stay fillable."
    : null
}

// Kept decoupled from objectStore's mutation logic (objectStore never imports
// documentStore) — dirty tracking is a subscription on the side, not a
// cross-store action call. Reference comparison on objectsByPage is valid
// because every mutating objectStore action (and every undo/redo of one)
// rebuilds it immutably; selectObject/startEditing/stopEditing don't touch
// it, so selection alone correctly never dirties the document.
useObjectStore.subscribe((state, prevState) => {
  if (state.objectsByPage !== prevState.objectsByPage) {
    useDocumentStore.getState().markDirty()
    window.api.notifyDirty(true)
  }
})
