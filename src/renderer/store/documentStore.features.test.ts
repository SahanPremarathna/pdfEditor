import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same convention as documentStore.test.ts: a 1-byte fake "PDF" whose value
// is its page count. A leading 0xFF byte marks it encrypted with password "pw".
vi.mock('../core/renderPdf', () => {
  class PasswordRequiredError extends Error {
    readonly incorrect: boolean
    constructor(incorrect: boolean) {
      super('password')
      this.incorrect = incorrect
    }
  }
  return {
    PasswordRequiredError,
    loadDocument: vi.fn(async (bytes: Uint8Array, password?: string) => {
      if (bytes[0] === 0xff) {
        if (password !== 'pw') throw new PasswordRequiredError(password !== undefined)
        return { numPages: bytes[1] }
      }
      return { numPages: bytes[0] }
    }),
    getPageSize: vi.fn(async () => ({ width: 612, height: 792 }))
  }
})

vi.mock('../core/exportPdf', () => ({
  exportPdf: vi.fn(async () => ({ bytes: new Uint8Array([1, 2, 3]), forcedFlatten: false }))
}))

import { exportPdf } from '../core/exportPdf'
import { useHistoryStore } from '../core/history'
import { createShapeObject } from '../core/objects'
import { useDocumentStore } from './documentStore'
import { useObjectStore } from './objectStore'
import { useWatermarkStore } from './watermarkStore'
import type { PageMeta } from '../../shared/types'

const api = {
  openDialog: vi.fn(),
  readFile: vi.fn(),
  save: vi.fn(),
  saveAs: vi.fn(),
  notifyDirty: vi.fn(),
  onRequestSaveBeforeClose: vi.fn(() => () => {}),
  notifySaveBeforeCloseResult: vi.fn(),
  registerFile: vi.fn(async (file: File) => ({ path: `web:x/${file.name}`, bytes: new Uint8Array(await file.arrayBuffer()) })),
  download: vi.fn()
}

const initialDocState = useDocumentStore.getState()
const initialHistoryState = useHistoryStore.getState()
const initialObjectState = useObjectStore.getState()
const initialWatermarkState = useWatermarkStore.getState()

beforeEach(() => {
  vi.stubGlobal('window', { api })
  vi.clearAllMocks()
  useDocumentStore.setState(initialDocState, true)
  useHistoryStore.setState(initialHistoryState, true)
  useObjectStore.setState(initialObjectState, true)
  useWatermarkStore.setState(initialWatermarkState, true)
})

async function openPdf(numPages: number): Promise<void> {
  api.openDialog.mockResolvedValueOnce({ path: '/tmp/doc.pdf', bytes: new Uint8Array([numPages]) })
  await useDocumentStore.getState().openFile()
}

const ids = (pages: PageMeta[]): number[] => pages.map((p) => p.index)

describe('openFileObject', () => {
  it('opens a dropped PDF through the platform', async () => {
    const file = new File([new Uint8Array([2])], 'dropped.pdf', { type: 'application/pdf' })
    await useDocumentStore.getState().openFileObject(file)
    expect(api.registerFile).toHaveBeenCalledWith(file)
    expect(useDocumentStore.getState().fileName).toBe('dropped.pdf')
    expect(useDocumentStore.getState().pages).toHaveLength(2)
  })

  it('rejects a non-PDF file with an error', async () => {
    await useDocumentStore.getState().openFileObject(new File(['x'], 'notes.txt', { type: 'text/plain' }))
    expect(useDocumentStore.getState().error).toMatch(/isn't a PDF/)
    expect(useDocumentStore.getState().pdfDoc).toBeNull()
  })
})

describe('opening a document', () => {
  it('drops the previous document’s objects (they belong to its pages)', async () => {
    await openPdf(1)
    useObjectStore.getState().addObject(createShapeObject('rect', 0, 0, 0, 10, 10, 0))
    await openPdf(1)
    expect(useObjectStore.getState().objectsByPage).toEqual({})
    expect(useDocumentStore.getState().isDirty).toBe(false)
  })
})

describe('password-protected PDFs', () => {
  const encrypted = new Uint8Array([0xff, 3])

  it('prompts, re-prompts on a wrong password, then opens', async () => {
    api.openDialog.mockResolvedValueOnce({ path: '/tmp/locked.pdf', bytes: encrypted })
    await useDocumentStore.getState().openFile()
    expect(useDocumentStore.getState().passwordPrompt).toEqual({ fileName: 'locked.pdf', incorrect: false })
    expect(useDocumentStore.getState().pdfDoc).toBeNull()

    await useDocumentStore.getState().submitPassword('nope')
    expect(useDocumentStore.getState().passwordPrompt).toEqual({ fileName: 'locked.pdf', incorrect: true })

    await useDocumentStore.getState().submitPassword('pw')
    const state = useDocumentStore.getState()
    expect(state.passwordPrompt).toBeNull()
    expect(state.pages).toHaveLength(3)
    expect(state.isEncrypted).toBe(true)
    expect(state.notice).toMatch(/cannot save/i)
  })

  it('cancelling leaves the previously open document untouched', async () => {
    await openPdf(2)
    api.openDialog.mockResolvedValueOnce({ path: '/tmp/locked.pdf', bytes: encrypted })
    await useDocumentStore.getState().openFile()
    useDocumentStore.getState().cancelPassword()
    expect(useDocumentStore.getState().fileName).toBe('doc.pdf')
    expect(useDocumentStore.getState().pages).toHaveLength(2)
    expect(useDocumentStore.getState().passwordPrompt).toBeNull()
  })
})

describe('duplicatePage', () => {
  it('inserts a copy after the page, copying its objects and watermark coverage', async () => {
    await openPdf(2)
    useObjectStore.getState().addObject(createShapeObject('rect', 0, 5, 5, 10, 10, 0))
    useWatermarkStore.setState({ config: { ...useWatermarkStore.getState().config, pageIndices: [0] } })

    useDocumentStore.getState().duplicatePage(0)

    const pages = useDocumentStore.getState().pages
    expect(ids(pages)).toEqual([0, 2, 1])
    expect(pages[1].source).toEqual(pages[0].source)
    const copied = useObjectStore.getState().objectsByPage[2]
    expect(copied).toHaveLength(1)
    expect(copied[0].pageIndex).toBe(2)
    expect(copied[0].id).not.toBe(useObjectStore.getState().objectsByPage[0][0].id)
    expect(useWatermarkStore.getState().config.pageIndices).toEqual([0, 2])
  })

  it('undoes page, objects and watermark in ONE step', async () => {
    await openPdf(1)
    useObjectStore.getState().addObject(createShapeObject('rect', 0, 5, 5, 10, 10, 0))
    const depth = useHistoryStore.getState().undoStack.length

    useDocumentStore.getState().duplicatePage(0)
    expect(useHistoryStore.getState().undoStack.length).toBe(depth + 1)

    useHistoryStore.getState().undo()
    expect(ids(useDocumentStore.getState().pages)).toEqual([0])
    expect(useObjectStore.getState().objectsByPage[1]).toBeUndefined()

    useHistoryStore.getState().redo()
    expect(ids(useDocumentStore.getState().pages)).toEqual([0, 1])
    expect(useObjectStore.getState().objectsByPage[1]).toHaveLength(1)
  })
})

describe('extractPages', () => {
  it('exports only the chosen pages and downloads them, leaving the document alone', async () => {
    await openPdf(3)
    const before = useDocumentStore.getState().pages

    await useDocumentStore.getState().extractPages([2, 0])

    const exportedPages = vi.mocked(exportPdf).mock.calls[0][2]
    expect(exportedPages.map((p) => [p.index, p.deleted])).toEqual([
      [0, false],
      [1, true],
      [2, false]
    ])
    expect(api.download).toHaveBeenCalledWith('doc (pages 1,3).pdf', new Uint8Array([1, 2, 3]))
    expect(useDocumentStore.getState().pages).toBe(before)
    expect(useDocumentStore.getState().absolutePath).toBe('/tmp/doc.pdf')
  })
})

describe('closeDocument', () => {
  it('returns to the empty state and clears history', async () => {
    await openPdf(2)
    useDocumentStore.getState().deletePage(0)
    useDocumentStore.getState().closeDocument()
    const state = useDocumentStore.getState()
    expect(state.pdfDoc).toBeNull()
    expect(state.pages).toEqual([])
    expect(state.isDirty).toBe(false)
    expect(useHistoryStore.getState().undoStack).toEqual([])
    expect(api.notifyDirty).toHaveBeenLastCalledWith(false)
  })
})

describe('objectStore.duplicateObject', () => {
  it('copies the object offset on top, selects it, and is one undo step', async () => {
    await openPdf(1)
    const rect = createShapeObject('rect', 0, 5, 5, 10, 10, 0)
    useObjectStore.getState().addObject(rect)

    const newId = useObjectStore.getState().duplicateObject(rect.id)

    const objects = useObjectStore.getState().objectsByPage[0]
    expect(objects).toHaveLength(2)
    expect(objects[1]).toMatchObject({ id: newId, x: 17, y: 17, z: 1 })
    expect(useObjectStore.getState().selectedId).toBe(newId)

    useHistoryStore.getState().undo()
    expect(useObjectStore.getState().objectsByPage[0]).toHaveLength(1)
  })

  it('returns null for an unknown id', () => {
    expect(useObjectStore.getState().duplicateObject('nope')).toBeNull()
  })
})

describe('completedExports', () => {
  it('counts successful saves, save-as and extractions only', async () => {
    await openPdf(2)
    const count = (): number => useDocumentStore.getState().completedExports
    const start = count()

    await useDocumentStore.getState().save()
    expect(count()).toBe(start + 1)

    api.saveAs.mockResolvedValueOnce(null) // cancelled dialog
    await useDocumentStore.getState().saveAs()
    expect(count()).toBe(start + 1)

    api.saveAs.mockResolvedValueOnce('/tmp/copy.pdf')
    await useDocumentStore.getState().saveAs()
    expect(count()).toBe(start + 2)

    api.save.mockRejectedValueOnce(new Error('disk full'))
    await useDocumentStore.getState().save()
    expect(count()).toBe(start + 2)

    await useDocumentStore.getState().extractPages([0])
    expect(count()).toBe(start + 3)
  })
})
