import { create } from 'zustand'
import { normalizeRotation } from '../core/coords'
import { exportPdf, type ExportResult } from '../core/exportPdf'
import { extractionFileName, pagesForExtraction, visualPageNumbers } from '../core/extractPages'
import { readFormFields } from '../core/formFields'
import { useHistoryStore } from '../core/history'
import { getPageSize, loadDocument, PasswordRequiredError, type PDFDocumentProxy } from '../core/renderPdf'
import { downloadCopy, loadAppFont, platform } from '../platform'
import { useFormStore } from './formStore'
import { useObjectStore } from './objectStore'
import { useUiStore } from './uiStore'
import { useWatermarkStore } from './watermarkStore'
import type { PageMeta, PdfObject } from '../../shared/types'

const DEFAULT_PAGE_WIDTH_PT = 612 // US Letter, used only when inserting a blank page into an empty document
const DEFAULT_PAGE_HEIGHT_PT = 792

interface ImportedDoc {
  pdfDoc: PDFDocumentProxy
  bytes: Uint8Array
}

/** Shown while an encrypted PDF waits for its password. */
export interface PasswordPrompt {
  fileName: string
  incorrect: boolean
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
  /** Opened with a password: viewable and annotatable, but pdf-lib cannot
   *  re-encrypt, so saving is refused (with an honest message) on export. */
  isEncrypted: boolean
  passwordPrompt: PasswordPrompt | null
  error: string | null
  /** A dismissible, non-error informational message (e.g. "saved with forms
   *  flattened") — separate from `error` so the two never stomp each other. */
  notice: string | null
  /** Successful saves/extractions this session — the support card listens
   *  to it. Only ever incremented after the file has been written. */
  completedExports: number
  openFile: () => Promise<void>
  openPath: (path: string) => Promise<void>
  /** A File from drag-and-drop or the welcome screen's drop zone. */
  openFileObject: (file: File) => Promise<void>
  submitPassword: (password: string) => Promise<void>
  cancelPassword: () => void
  closeDocument: () => void
  save: () => Promise<void>
  saveAs: () => Promise<void>
  markDirty: () => void
  clearError: () => void
  clearNotice: () => void
  showError: (message: string) => void

  rotatePage: (pageId: number, direction: 'cw' | 'ccw') => void
  deletePage: (pageId: number) => void
  reorderPages: (draggedPageId: number, targetPageId: number) => void
  insertBlankPage: (afterPageId: number | null, size?: { widthPt: number; heightPt: number }) => void
  importPagesFromFile: (afterPageId: number | null) => Promise<void>
  duplicatePage: (pageId: number) => void
  /** Downloads a new PDF containing only `pageIds` (with all edits applied).
   *  The open document is left untouched. */
  extractPages: (pageIds: number[]) => Promise<void>
}

/** Bytes of an encrypted file awaiting its password. Module-level rather than
 *  store state: nothing renders from it, and it can be large. */
let pendingOpen: { path: string; bytes: Uint8Array } | null = null

const errorMessage = (err: unknown, fallback: string): string => (err instanceof Error ? err.message : fallback)

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
  platform().notifyDirty(true)
  useHistoryStore.getState().push({
    undo: () => useDocumentStore.setState({ pages: before }),
    redo: () => useDocumentStore.setState({ pages: after })
  })
}

const EMPTY_DOCUMENT = {
  fileName: null,
  absolutePath: null,
  originalBytes: null,
  pdfDoc: null,
  pages: [],
  importedDocs: {},
  nextPageId: 0,
  isDirty: false,
  isEncrypted: false
} satisfies Partial<DocumentState>

/** Clears every per-document store — undo history, objects, form fields and
 *  the watermark would otherwise reference a document that's no longer open. */
function resetDocumentScopedStores(): void {
  useHistoryStore.getState().clear()
  useFormStore.getState().reset()
  useWatermarkStore.getState().reset()
  useObjectStore.setState({ objectsByPage: {}, selectedId: null, activeEditingId: null })
}

/**
 * Shared by every open path (dialog, recent file, drag-and-drop, password
 * retry) — everything after "bytes for the file at `path` are known" is
 * identical. Loads the new pdf.js doc FIRST, so a failure (or a password
 * prompt that gets cancelled) leaves whatever was open before untouched;
 * only then resets per-document stores, builds an identity `pages` list, and
 * non-fatally reads any AcroForm fields (a read failure must never block
 * opening the document).
 */
async function finishOpening(
  set: (partial: Partial<DocumentState>) => void,
  path: string,
  bytes: Uint8Array,
  password?: string
): Promise<void> {
  // pdf.js transfers this buffer to its worker thread (a Transferable, for
  // performance), which DETACHES it in the main thread — keep an
  // independent copy for exportPdf's later use, or originalBytes would
  // silently become a zero-length buffer the moment the PDF renders.
  const originalBytes = bytes.slice()
  const fileName = path.split(/[/\\]/).pop() ?? path

  let pdfDoc: PDFDocumentProxy
  try {
    pdfDoc = await loadDocument(bytes, password)
  } catch (err) {
    if (err instanceof PasswordRequiredError) {
      pendingOpen = { path, bytes: originalBytes }
      set({ isLoading: false, passwordPrompt: { fileName, incorrect: err.incorrect } })
      return
    }
    throw err
  }
  pendingOpen = null

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

  resetDocumentScopedStores()
  const isEncrypted = password !== undefined
  set({
    fileName,
    absolutePath: path,
    originalBytes,
    pdfDoc,
    pages,
    importedDocs: {},
    nextPageId: pdfDoc.numPages,
    isLoading: false,
    isDirty: false,
    isEncrypted,
    passwordPrompt: null,
    notice: isEncrypted
      ? 'Unlocked for viewing. Encrypted PDFs can be annotated, but TrueFreePDF cannot save them.'
      : null
  })
  platform().notifyDirty(false)

  try {
    useFormStore.getState().setFields(await readFormFields(originalBytes))
  } catch {
    // No AcroForm, or unreadable (e.g. encrypted) — leave fields empty. Never blocks opening.
  }
}

/** Runs exportPdf against the current document state. `pages` can be
 *  overridden (page extraction exports a subset). */
async function exportCurrent(state: DocumentState, pages: PageMeta[] = state.pages): Promise<ExportResult> {
  if (!state.originalBytes) throw new Error('No document is open')
  const importedSources = Object.fromEntries(Object.entries(state.importedDocs).map(([id, doc]) => [id, doc.bytes]))
  return exportPdf(
    state.originalBytes,
    useObjectStore.getState().objectsByPage,
    pages,
    importedSources,
    useFormStore.getState().fields,
    useUiStore.getState().flattenOnExport,
    useWatermarkStore.getState().config,
    { loadFont: loadAppFont }
  )
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  ...EMPTY_DOCUMENT,
  isLoading: false,
  isSaving: false,
  passwordPrompt: null,
  error: null,
  notice: null,
  completedExports: 0,

  openFile: async () => {
    set({ isLoading: true, error: null, notice: null })
    try {
      const result = await platform().openDialog()
      if (!result) {
        set({ isLoading: false })
        return
      }
      await finishOpening(set, result.path, result.bytes)
    } catch (err) {
      set({ isLoading: false, error: errorMessage(err, 'Failed to open PDF') })
    }
  },

  openPath: async (path) => {
    set({ isLoading: true, error: null, notice: null })
    try {
      const bytes = await platform().readFile(path)
      await finishOpening(set, path, bytes)
    } catch (err) {
      set({ isLoading: false, error: errorMessage(err, 'Failed to open PDF') })
    }
  },

  openFileObject: async (file) => {
    const api = platform()
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      set({ error: `"${file.name}" isn't a PDF.` })
      return
    }
    set({ isLoading: true, error: null, notice: null })
    try {
      const result = api.registerFile
        ? await api.registerFile(file)
        : { path: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
      await finishOpening(set, result.path, result.bytes)
    } catch (err) {
      set({ isLoading: false, error: errorMessage(err, 'Failed to open PDF') })
    }
  },

  submitPassword: async (password) => {
    const pending = pendingOpen
    if (!pending) {
      set({ passwordPrompt: null })
      return
    }
    set({ isLoading: true, error: null })
    try {
      // loadDocument detaches what it's given — hand it a copy so a wrong
      // password leaves `pending.bytes` intact for the next attempt.
      await finishOpening(set, pending.path, pending.bytes.slice(), password)
    } catch (err) {
      pendingOpen = null
      set({ isLoading: false, passwordPrompt: null, error: errorMessage(err, 'Failed to open PDF') })
    }
  },

  cancelPassword: () => {
    pendingOpen = null
    set({ passwordPrompt: null, isLoading: false })
  },

  closeDocument: () => {
    resetDocumentScopedStores()
    set({ ...EMPTY_DOCUMENT, error: null, notice: null })
    platform().notifyDirty(false)
  },

  save: async () => {
    const state = get()
    if (!state.originalBytes) return
    if (!state.absolutePath) {
      await get().saveAs()
      return
    }

    set({ isSaving: true, error: null, notice: null })
    try {
      const { bytes, forcedFlatten } = await exportCurrent(state)
      await platform().save(state.absolutePath, bytes)
      set((s) => ({
        isSaving: false,
        isDirty: false,
        notice: forcedFlattenNotice(forcedFlatten),
        completedExports: s.completedExports + 1
      }))
      platform().notifyDirty(false)
    } catch (err) {
      set({ isSaving: false, error: errorMessage(err, 'Failed to save') })
    }
  },

  saveAs: async () => {
    const state = get()
    if (!state.originalBytes) return

    set({ isSaving: true, error: null, notice: null })
    try {
      const { bytes, forcedFlatten } = await exportCurrent(state)
      const chosenPath = await platform().saveAs(state.fileName ?? 'document.pdf', bytes)
      if (chosenPath) {
        set({
          absolutePath: chosenPath,
          fileName: chosenPath.split(/[/\\]/).pop() ?? chosenPath,
          isSaving: false,
          completedExports: state.completedExports + 1,
          isDirty: false,
          notice: forcedFlattenNotice(forcedFlatten)
        })
        platform().notifyDirty(false)
      } else {
        set({ isSaving: false })
      }
    } catch (err) {
      set({ isSaving: false, error: errorMessage(err, 'Failed to save') })
    }
  },

  markDirty: () => set({ isDirty: true }),
  clearError: () => set({ error: null }),
  clearNotice: () => set({ notice: null }),
  showError: (message) => set({ error: message }),

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
    let result
    try {
      result = await platform().openDialog()
    } catch (err) {
      set({ error: errorMessage(err, 'Failed to import PDF') })
      return
    }
    if (!result) return

    // Same detach concern as openFile's originalBytes — keep an independent
    // copy before loadDocument transfers the original to pdf.js's worker.
    const bytes = result.bytes.slice()
    let pdfDoc: PDFDocumentProxy
    try {
      pdfDoc = await loadDocument(result.bytes)
    } catch (err) {
      set({
        error:
          err instanceof PasswordRequiredError
            ? "Password-protected PDFs can't be imported."
            : errorMessage(err, 'Failed to import PDF')
      })
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
  },

  /**
   * Inserts a copy of `pageId` right after it: same source and rotation,
   * a fresh stable id, fresh copies of its objects, and the watermark (if
   * it covers the original) extended to cover the copy. All three stores
   * change together, so they're recorded as ONE history entry — undo
   * removes the page and its copied objects in a single step.
   */
  duplicatePage: (pageId) => {
    const state = get()
    const pagesBefore = state.pages
    const idx = pagesBefore.findIndex((p) => p.index === pageId)
    if (idx === -1 || pagesBefore[idx].deleted) return

    const newId = state.nextPageId
    const copy: PageMeta = { ...pagesBefore[idx], index: newId }
    const pagesAfter = [...pagesBefore.slice(0, idx + 1), copy, ...pagesBefore.slice(idx + 1)]

    const objectsBefore = useObjectStore.getState().objectsByPage
    const sourceObjects = objectsBefore[pageId] ?? []
    const objectsAfter =
      sourceObjects.length > 0
        ? {
            ...objectsBefore,
            [newId]: sourceObjects.map((o): PdfObject => ({ ...o, id: crypto.randomUUID(), pageIndex: newId }))
          }
        : objectsBefore

    const watermarkBefore = useWatermarkStore.getState().config
    const watermarkAfter = watermarkBefore.pageIndices.includes(pageId)
      ? { ...watermarkBefore, pageIndices: [...watermarkBefore.pageIndices, newId] }
      : watermarkBefore

    const apply = (pages: PageMeta[], objectsByPage: Record<number, PdfObject[]>, config: typeof watermarkBefore): void => {
      useDocumentStore.setState({ pages, isDirty: true })
      useObjectStore.setState({ objectsByPage })
      useWatermarkStore.setState({ config })
    }

    set({ nextPageId: newId + 1 })
    apply(pagesAfter, objectsAfter, watermarkAfter)
    platform().notifyDirty(true)
    useHistoryStore.getState().push({
      undo: () => apply(pagesBefore, objectsBefore, watermarkBefore),
      redo: () => apply(pagesAfter, objectsAfter, watermarkAfter)
    })
  },

  extractPages: async (pageIds) => {
    const state = get()
    if (!state.originalBytes || pageIds.length === 0) return
    const numbers = visualPageNumbers(state.pages, pageIds)
    if (numbers.length === 0) return

    set({ isSaving: true, error: null, notice: null })
    try {
      const { bytes } = await exportCurrent(state, pagesForExtraction(state.pages, pageIds))
      await downloadCopy(extractionFileName(state.fileName, numbers), bytes)
      set((s) => ({ isSaving: false, completedExports: s.completedExports + 1 }))
    } catch (err) {
      set({ isSaving: false, error: errorMessage(err, 'Failed to extract pages') })
    }
  }
}))

function forcedFlattenNotice(forcedFlatten: boolean): string | null {
  return forcedFlatten
    ? "Saved with form fields flattened - this document had page changes, so its form couldn't stay fillable."
    : null
}

// Kept decoupled from objectStore's mutation logic (objectStore never imports
// documentStore) — dirty tracking is a subscription on the side, not a
// cross-store action call. Reference comparison on objectsByPage is valid
// because every mutating objectStore action (and every undo/redo of one)
// rebuilds it immutably; selectObject/startEditing/stopEditing don't touch
// it, so selection alone correctly never dirties the document. (Clearing
// objects on open/close also fires this, but both reset isDirty right after.)
useObjectStore.subscribe((state, prevState) => {
  if (state.objectsByPage !== prevState.objectsByPage) {
    useDocumentStore.getState().markDirty()
    platform().notifyDirty(true)
  }
})
