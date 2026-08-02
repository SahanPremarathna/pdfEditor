import { create } from 'zustand'
import type { PageMeta } from '../../shared/types'
import { getPageSize, loadDocument, type PDFDocumentProxy } from '../core/renderPdf'

interface DocumentState {
  fileName: string | null
  pdfDoc: PDFDocumentProxy | null
  pages: PageMeta[]
  isLoading: boolean
  error: string | null
  openFile: () => Promise<void>
}

export const useDocumentStore = create<DocumentState>((set) => ({
  fileName: null,
  pdfDoc: null,
  pages: [],
  isLoading: false,
  error: null,

  openFile: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.openDialog()
      if (!result) {
        set({ isLoading: false })
        return
      }

      const pdfDoc = await loadDocument(result.bytes)
      const pages: PageMeta[] = []
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const { width, height } = await getPageSize(pdfDoc, i)
        pages.push({ index: i - 1, widthPt: width, heightPt: height, rotation: 0, deleted: false })
      }

      const fileName = result.path.split(/[/\\]/).pop() ?? result.path
      set({ fileName, pdfDoc, pages, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to open PDF' })
    }
  }
}))
