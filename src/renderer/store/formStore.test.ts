import { beforeEach, describe, expect, it, vi } from 'vitest'

// formStore imports documentStore (for markDirty), which imports
// core/renderPdf — a side-effect import of pdfWorker.ts's Vite `?url` asset
// import — mocked out here so the module graph never touches that, matching
// documentStore.test.ts's own convention.
vi.mock('../core/renderPdf', () => ({
  loadDocument: vi.fn(),
  getPageSize: vi.fn()
}))

import { useHistoryStore } from '../core/history'
import { useDocumentStore } from './documentStore'
import { useFormStore } from './formStore'
import type { FormField, TextFormField } from '../../shared/types'

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

const initialFormState = useFormStore.getState()
const initialDocState = useDocumentStore.getState()
const initialHistoryState = useHistoryStore.getState()

beforeEach(() => {
  vi.stubGlobal('window', { api })
  vi.clearAllMocks()
  useFormStore.setState(initialFormState, true)
  useDocumentStore.setState(initialDocState, true)
  useHistoryStore.setState(initialHistoryState, true)
})

function textField(name: string, value: string, overrides: Partial<TextFormField> = {}): TextFormField {
  return { name, type: 'text', value, readOnly: false, required: false, multiline: false, maxLength: null, ...overrides }
}

describe('formStore', () => {
  it('setFields replaces the field list', () => {
    const fields: FormField[] = [textField('a', '1')]
    useFormStore.getState().setFields(fields)
    expect(useFormStore.getState().fields).toEqual(fields)
  })

  it('updateFieldValue patches the matching field by name', () => {
    useFormStore.getState().setFields([textField('a', '1'), textField('b', '2')])

    useFormStore.getState().updateFieldValue('a', { value: 'edited' })

    const fields = useFormStore.getState().fields as TextFormField[]
    expect(fields.find((f) => f.name === 'a')?.value).toBe('edited')
    expect(fields.find((f) => f.name === 'b')?.value).toBe('2')
  })

  it('updateFieldValue is a no-op on a read-only field', () => {
    useFormStore.getState().setFields([textField('a', '1', { readOnly: true })])

    useFormStore.getState().updateFieldValue('a', { value: 'edited' })

    expect((useFormStore.getState().fields[0] as TextFormField).value).toBe('1')
  })

  it('updateFieldValue is a no-op for an unknown field name', () => {
    useFormStore.getState().setFields([textField('a', '1')])
    const before = useFormStore.getState().fields

    useFormStore.getState().updateFieldValue('missing', { value: 'x' })

    expect(useFormStore.getState().fields).toBe(before)
  })

  it('updateFieldValue marks the document dirty and notifies main', () => {
    useFormStore.getState().setFields([textField('a', '1')])

    useFormStore.getState().updateFieldValue('a', { value: 'edited' })

    expect(useDocumentStore.getState().isDirty).toBe(true)
    expect(api.notifyDirty).toHaveBeenCalledWith(true)
  })

  it('updateFieldValue does NOT push onto the shared undo/redo stack', () => {
    useFormStore.getState().setFields([textField('a', '1')])

    useFormStore.getState().updateFieldValue('a', { value: 'edited' })

    expect(useHistoryStore.getState().undoStack).toEqual([])
  })

  it('reset clears the field list', () => {
    useFormStore.getState().setFields([textField('a', '1')])
    useFormStore.getState().reset()
    expect(useFormStore.getState().fields).toEqual([])
  })
})
