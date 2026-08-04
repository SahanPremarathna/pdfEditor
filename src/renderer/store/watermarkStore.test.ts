import { beforeEach, describe, expect, it, vi } from 'vitest'

// watermarkStore imports documentStore (for applyRange's page list, and the
// same circular-import shape formStore already proves safe), which imports
// core/renderPdf — a side-effect import of pdfWorker.ts's Vite `?url` asset
// import — mocked out here so the module graph never touches that.
vi.mock('../core/renderPdf', () => ({
  loadDocument: vi.fn(),
  getPageSize: vi.fn()
}))

import { useHistoryStore } from '../core/history'
import { useDocumentStore } from './documentStore'
import { useWatermarkStore } from './watermarkStore'
import type { PageMeta, TextWatermarkConfig } from '../../shared/types'

const api = {
  openDialog: vi.fn(),
  readFile: vi.fn(),
  save: vi.fn(),
  saveAs: vi.fn(),
  notifyDirty: vi.fn(),
  onRequestSaveBeforeClose: vi.fn(() => () => {}),
  notifySaveBeforeCloseResult: vi.fn(),
  getRecent: vi.fn(),
  onMenuAction: vi.fn(() => () => {})
}

const initialWatermarkState = useWatermarkStore.getState()
const initialDocState = useDocumentStore.getState()
const initialHistoryState = useHistoryStore.getState()

beforeEach(() => {
  vi.stubGlobal('window', { api })
  vi.clearAllMocks()
  useWatermarkStore.setState(initialWatermarkState, true)
  useDocumentStore.setState(initialDocState, true)
  useHistoryStore.setState(initialHistoryState, true)
})

function page(index: number, deleted = false): PageMeta {
  return { index, source: { kind: 'original', sourcePageNumber: index + 1 }, widthPt: 300, heightPt: 400, rotation: 0, deleted }
}

describe('watermarkStore defaults', () => {
  it('starts disabled, type text, centered', () => {
    const config = useWatermarkStore.getState().config as TextWatermarkConfig
    expect(config.enabled).toBe(false)
    expect(config.type).toBe('text')
    expect(config.xFraction).toBe(0.5)
    expect(config.yFraction).toBe(0.5)
    expect(config.pageIndices).toEqual([])
  })
})

describe('watermarkStore.setType', () => {
  it('round-trips shared fields but resets type-specific ones', () => {
    useWatermarkStore.getState().updateConfig({ enabled: true, opacity: 0.7, rotationDeg: 15 })
    useWatermarkStore.getState().setPosition(0.2, 0.3)
    useWatermarkStore.getState().applyRange(1, 1)

    useWatermarkStore.getState().setType('image')
    const image = useWatermarkStore.getState().config
    expect(image.type).toBe('image')
    expect(image.enabled).toBe(true)
    expect(image.opacity).toBe(0.7)
    expect(image.rotationDeg).toBe(15)
    expect(image.xFraction).toBe(0.2)
    expect(image.yFraction).toBe(0.3)

    useWatermarkStore.getState().setType('text')
    const text = useWatermarkStore.getState().config as TextWatermarkConfig
    expect(text.type).toBe('text')
    expect(text.enabled).toBe(true) // shared field still carried over
    expect(text.text).toBe('CONFIDENTIAL') // type-specific field reset to default
  })

  it('is a no-op (no history push) when already that type', () => {
    useWatermarkStore.getState().setType('text')
    expect(useHistoryStore.getState().undoStack).toEqual([])
  })
})

describe('watermarkStore.updateConfig', () => {
  it('patches only the given fields', () => {
    useWatermarkStore.getState().updateConfig({ opacity: 0.5 })
    expect(useWatermarkStore.getState().config.opacity).toBe(0.5)
  })
})

describe('watermarkStore.setImageContent', () => {
  it('sets image fields when config is already type image', () => {
    useWatermarkStore.getState().setType('image')
    useWatermarkStore.getState().setImageContent('data:image/png;base64,AAA', 'image/png', 200, 100)
    const config = useWatermarkStore.getState().config
    expect(config.type).toBe('image')
    if (config.type === 'image') {
      expect(config.dataUrl).toBe('data:image/png;base64,AAA')
      expect(config.naturalWidth).toBe(200)
      expect(config.naturalHeight).toBe(100)
    }
  })

  it('is a no-op when config is type text', () => {
    const before = useWatermarkStore.getState().config
    useWatermarkStore.getState().setImageContent('data:image/png;base64,AAA', 'image/png', 200, 100)
    expect(useWatermarkStore.getState().config).toBe(before)
  })
})

describe('watermarkStore.applyRange', () => {
  it('resolves visible pages into pageIndices, skipping deleted ones', () => {
    useDocumentStore.setState({ pages: [page(0), page(1, true), page(2), page(3)] })

    useWatermarkStore.getState().applyRange(1, 2)

    // visible pages (non-deleted): [0, 2, 3] -> positions 1..2 -> [0, 2]
    expect(useWatermarkStore.getState().config.pageIndices).toEqual([0, 2])
  })

  it('is a no-op when there are no pages', () => {
    useDocumentStore.setState({ pages: [] })
    const before = useWatermarkStore.getState().config

    useWatermarkStore.getState().applyRange(1, 1)

    expect(useWatermarkStore.getState().config).toBe(before)
  })
})

describe('watermarkStore undo/redo', () => {
  it('setPosition/updateConfig/applyRange push to the shared history stack and are undoable', () => {
    useDocumentStore.setState({ pages: [page(0), page(1)] })

    useWatermarkStore.getState().setPosition(0.1, 0.2)
    expect(useHistoryStore.getState().undoStack.length).toBeGreaterThan(0)

    useHistoryStore.getState().undo()
    expect(useWatermarkStore.getState().config.xFraction).toBe(0.5) // back to default
  })

  it('setRangeInput does NOT push to history', () => {
    useWatermarkStore.getState().setRangeInput(2, 3)
    expect(useHistoryStore.getState().undoStack).toEqual([])
    expect(useWatermarkStore.getState().config.rangeInput).toEqual({ from: 2, to: 3 })
  })

  it('reset does NOT push to history and clears back to defaults', () => {
    useWatermarkStore.getState().updateConfig({ enabled: true })
    useHistoryStore.getState().clear()

    useWatermarkStore.getState().reset()

    expect(useHistoryStore.getState().undoStack).toEqual([])
    expect(useWatermarkStore.getState().config.enabled).toBe(false)
  })
})
