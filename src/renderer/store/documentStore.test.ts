import { beforeEach, describe, expect, it, vi } from 'vitest'

// documentStore imports core/renderPdf, which side-effect-imports pdfWorker.ts
// (a Vite `?url` asset import) — mocked out here so the module graph never
// touches that, matching the existing test suite's convention of only
// exercising real pdf.js via the legacy build in the acceptance tests.
vi.mock('../core/renderPdf', () => ({
  loadDocument: vi.fn(async (bytes: Uint8Array) => ({ numPages: bytes[0] })),
  getPageSize: vi.fn(async () => ({ width: 612, height: 792 }))
}))

import { useHistoryStore } from '../core/history'
import { useObjectStore } from './objectStore'
import { useDocumentStore } from './documentStore'

/** Encodes a page count as a 1-byte "PDF" so the mocked loadDocument can read
 *  it back deterministically without touching real pdf.js. */
function fakePdfBytes(numPages: number): Uint8Array {
  return new Uint8Array([numPages])
}

const api = {
  openDialog: vi.fn(),
  readFile: vi.fn(),
  save: vi.fn(),
  saveAs: vi.fn(),
  notifyDirty: vi.fn(),
  onRequestSaveBeforeClose: vi.fn(() => () => {}),
  notifySaveBeforeCloseResult: vi.fn()
}

const initialDocState = useDocumentStore.getState()
const initialHistoryState = useHistoryStore.getState()
const initialObjectState = useObjectStore.getState()

beforeEach(() => {
  vi.stubGlobal('window', { api })
  vi.clearAllMocks()
  useDocumentStore.setState(initialDocState, true)
  useHistoryStore.setState(initialHistoryState, true)
  useObjectStore.setState(initialObjectState, true)
})

async function openThreePagePdf(): Promise<void> {
  api.openDialog.mockResolvedValueOnce({ path: '/tmp/doc.pdf', bytes: fakePdfBytes(3) })
  await useDocumentStore.getState().openFile()
}

describe('documentStore.openFile', () => {
  it('builds one original-source PageMeta per page', async () => {
    await openThreePagePdf()

    const pages = useDocumentStore.getState().pages
    expect(pages).toHaveLength(3)
    expect(pages.map((p) => p.index)).toEqual([0, 1, 2])
    expect(pages.every((p) => !p.deleted && p.rotation === 0)).toBe(true)
    expect(pages.map((p) => p.source)).toEqual([
      { kind: 'original', sourcePageNumber: 1 },
      { kind: 'original', sourcePageNumber: 2 },
      { kind: 'original', sourcePageNumber: 3 }
    ])
  })

  it('clears the undo/redo stack', async () => {
    await openThreePagePdf()
    useDocumentStore.getState().deletePage(0)
    expect(useHistoryStore.getState().undoStack.length).toBeGreaterThan(0)

    await openThreePagePdf()

    expect(useHistoryStore.getState().undoStack).toEqual([])
    expect(useHistoryStore.getState().redoStack).toEqual([])
  })

  it('resets importedDocs and seeds nextPageId to the page count', async () => {
    await openThreePagePdf()
    expect(useDocumentStore.getState().importedDocs).toEqual({})
    expect(useDocumentStore.getState().nextPageId).toBe(3)
  })
})

describe('documentStore.rotatePage', () => {
  it('normalizes rotation and swaps width/height on each 90deg step', async () => {
    await openThreePagePdf()

    useDocumentStore.getState().rotatePage(0, 'cw')
    let page = useDocumentStore.getState().pages[0]
    expect(page.rotation).toBe(90)
    expect(page.widthPt).toBe(792)
    expect(page.heightPt).toBe(612)

    useDocumentStore.getState().rotatePage(0, 'ccw')
    page = useDocumentStore.getState().pages[0]
    expect(page.rotation).toBe(0)
    expect(page.widthPt).toBe(612)
    expect(page.heightPt).toBe(792)
  })

  it('is undoable', async () => {
    await openThreePagePdf()
    useDocumentStore.getState().rotatePage(0, 'cw')

    useHistoryStore.getState().undo()

    expect(useDocumentStore.getState().pages[0].rotation).toBe(0)
  })

  it('is a no-op for an unknown page id', async () => {
    await openThreePagePdf()
    const before = useDocumentStore.getState().pages
    useDocumentStore.getState().rotatePage(999, 'cw')
    expect(useDocumentStore.getState().pages).toBe(before)
  })
})

describe('documentStore.deletePage', () => {
  it('soft-deletes without removing the entry', async () => {
    await openThreePagePdf()
    useDocumentStore.getState().deletePage(1)

    const pages = useDocumentStore.getState().pages
    expect(pages).toHaveLength(3)
    expect(pages.find((p) => p.index === 1)?.deleted).toBe(true)
  })

  it('is undoable', async () => {
    await openThreePagePdf()
    useDocumentStore.getState().deletePage(1)

    useHistoryStore.getState().undo()

    expect(useDocumentStore.getState().pages.find((p) => p.index === 1)?.deleted).toBe(false)
  })

  it('is a no-op if already deleted', async () => {
    await openThreePagePdf()
    useDocumentStore.getState().deletePage(1)
    const stackLength = useHistoryStore.getState().undoStack.length

    useDocumentStore.getState().deletePage(1)

    expect(useHistoryStore.getState().undoStack).toHaveLength(stackLength)
  })
})

describe('documentStore.reorderPages', () => {
  it('moves the dragged page to just before the target page', async () => {
    await openThreePagePdf()
    useDocumentStore.getState().reorderPages(0, 2) // move page 0 to just before page 2

    expect(useDocumentStore.getState().pages.map((p) => p.index)).toEqual([1, 0, 2])
  })

  it('is undoable', async () => {
    await openThreePagePdf()
    useDocumentStore.getState().reorderPages(0, 2)

    useHistoryStore.getState().undo()

    expect(useDocumentStore.getState().pages.map((p) => p.index)).toEqual([0, 1, 2])
  })

  it('is a no-op when dragged and target are the same page', async () => {
    await openThreePagePdf()
    const before = useDocumentStore.getState().pages
    useDocumentStore.getState().reorderPages(1, 1)
    expect(useDocumentStore.getState().pages).toBe(before)
  })
})

describe('documentStore.insertBlankPage', () => {
  it('inserts a new page with a fresh id right after the given page', async () => {
    await openThreePagePdf()
    useDocumentStore.getState().insertBlankPage(0)

    const pages = useDocumentStore.getState().pages
    expect(pages.map((p) => p.index)).toEqual([0, 3, 1, 2])
    expect(pages[1].source).toEqual({ kind: 'blank' })
    expect(pages[1].widthPt).toBe(612) // sized from the page it's inserted after
    expect(pages[1].heightPt).toBe(792)
  })

  it('appends at the end when afterPageId is null', async () => {
    await openThreePagePdf()
    useDocumentStore.getState().insertBlankPage(null)

    const pages = useDocumentStore.getState().pages
    expect(pages.map((p) => p.index)).toEqual([0, 1, 2, 3])
  })

  it('never reuses an id, even across undo', async () => {
    await openThreePagePdf()
    useDocumentStore.getState().insertBlankPage(0)
    expect(useDocumentStore.getState().nextPageId).toBe(4)

    useHistoryStore.getState().undo()
    expect(useDocumentStore.getState().nextPageId).toBe(4) // not rolled back

    useDocumentStore.getState().insertBlankPage(0)
    expect(useDocumentStore.getState().pages.map((p) => p.index)).toContain(4)
  })

  it('is undoable', async () => {
    await openThreePagePdf()
    useDocumentStore.getState().insertBlankPage(0)

    useHistoryStore.getState().undo()

    expect(useDocumentStore.getState().pages.map((p) => p.index)).toEqual([0, 1, 2])
  })
})

describe('documentStore.importPagesFromFile', () => {
  it('imports every page of the picked file after the given page', async () => {
    await openThreePagePdf()
    api.openDialog.mockResolvedValueOnce({ path: '/tmp/other.pdf', bytes: fakePdfBytes(2) })

    await useDocumentStore.getState().importPagesFromFile(0)

    const pages = useDocumentStore.getState().pages
    expect(pages.map((p) => p.index)).toEqual([0, 3, 4, 1, 2])
    const importId = (pages[1].source as { kind: 'imported'; importId: string }).importId
    expect(pages[1].source).toEqual({ kind: 'imported', importId, sourcePageNumber: 1 })
    expect(pages[2].source).toEqual({ kind: 'imported', importId, sourcePageNumber: 2 })
    expect(Object.keys(useDocumentStore.getState().importedDocs)).toEqual([importId])
  })

  it('does nothing if the dialog is cancelled', async () => {
    await openThreePagePdf()
    api.openDialog.mockResolvedValueOnce(null)
    const before = useDocumentStore.getState().pages

    await useDocumentStore.getState().importPagesFromFile(0)

    expect(useDocumentStore.getState().pages).toBe(before)
  })

  it('is undoable', async () => {
    await openThreePagePdf()
    api.openDialog.mockResolvedValueOnce({ path: '/tmp/other.pdf', bytes: fakePdfBytes(2) })
    await useDocumentStore.getState().importPagesFromFile(0)

    useHistoryStore.getState().undo()

    expect(useDocumentStore.getState().pages.map((p) => p.index)).toEqual([0, 1, 2])
  })
})
