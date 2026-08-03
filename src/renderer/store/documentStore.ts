import { create } from 'zustand'
import { exportPdf } from '../core/exportPdf'
import { getPageSize, loadDocument, type PDFDocumentProxy } from '../core/renderPdf'
import { useObjectStore } from './objectStore'
import type { PageMeta } from '../../shared/types'

interface DocumentState {
  fileName: string | null
  absolutePath: string | null
  originalBytes: Uint8Array | null
  pdfDoc: PDFDocumentProxy | null
  pages: PageMeta[]
  isLoading: boolean
  isSaving: boolean
  isDirty: boolean
  error: string | null
  openFile: () => Promise<void>
  save: () => Promise<void>
  saveAs: () => Promise<void>
  markDirty: () => void
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  fileName: null,
  absolutePath: null,
  originalBytes: null,
  pdfDoc: null,
  pages: [],
  isLoading: false,
  isSaving: false,
  isDirty: false,
  error: null,

  openFile: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.openDialog()
      if (!result) {
        set({ isLoading: false })
        return
      }

      // pdf.js transfers this buffer to its worker thread (a Transferable,
      // for performance), which DETACHES it in the main thread — keep an
      // independent copy for exportPdf's later use, or originalBytes would
      // silently become a zero-length buffer the moment the PDF renders.
      const originalBytes = result.bytes.slice()

      const pdfDoc = await loadDocument(result.bytes)
      const pages: PageMeta[] = []
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const { width, height } = await getPageSize(pdfDoc, i)
        pages.push({ index: i - 1, widthPt: width, heightPt: height, rotation: 0, deleted: false })
      }

      const fileName = result.path.split(/[/\\]/).pop() ?? result.path
      set({
        fileName,
        absolutePath: result.path,
        originalBytes,
        pdfDoc,
        pages,
        isLoading: false,
        isDirty: false
      })
      window.api.notifyDirty(false)
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to open PDF' })
    }
  },

  save: async () => {
    const { originalBytes, absolutePath } = get()
    if (!originalBytes) return
    if (!absolutePath) {
      await get().saveAs()
      return
    }

    set({ isSaving: true, error: null })
    try {
      const bytes = await exportPdf(originalBytes, useObjectStore.getState().objectsByPage)
      await window.api.save(absolutePath, bytes)
      set({ isSaving: false, isDirty: false })
      window.api.notifyDirty(false)
    } catch (err) {
      set({ isSaving: false, error: err instanceof Error ? err.message : 'Failed to save' })
    }
  },

  saveAs: async () => {
    const { originalBytes, fileName } = get()
    if (!originalBytes) return

    set({ isSaving: true, error: null })
    try {
      const bytes = await exportPdf(originalBytes, useObjectStore.getState().objectsByPage)
      const chosenPath = await window.api.saveAs(fileName ?? 'document.pdf', bytes)
      if (chosenPath) {
        set({
          absolutePath: chosenPath,
          fileName: chosenPath.split(/[/\\]/).pop() ?? chosenPath,
          isSaving: false,
          isDirty: false
        })
        window.api.notifyDirty(false)
      } else {
        set({ isSaving: false })
      }
    } catch (err) {
      set({ isSaving: false, error: err instanceof Error ? err.message : 'Failed to save' })
    }
  },

  markDirty: () => set({ isDirty: true })
}))

// Kept decoupled from objectStore's mutation logic (objectStore never imports
// documentStore) — dirty tracking is a subscription on the side, not a
// cross-store action call. Reference comparison on objectsByPage is valid
// because every mutating objectStore action rebuilds it immutably;
// selectObject/startEditing/stopEditing don't touch it, so selection alone
// correctly never dirties the document.
useObjectStore.subscribe((state, prevState) => {
  if (state.objectsByPage !== prevState.objectsByPage) {
    useDocumentStore.getState().markDirty()
    window.api.notifyDirty(true)
  }
})
