/**
 * Covers the fork this phase added to exportPdf: filling AcroForm fields
 * stays genuinely fillable when the page list is untouched (the identity
 * fast path bypasses the fresh-document reconstruction, which does NOT
 * carry AcroForm fields across `copyPages` — verified directly during
 * planning), and gets force-flattened into page content when any page op
 * has been used instead of silently losing the filled-in values.
 */
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { exportPdf, isIdentityPageList } from './exportPdf'
import { identityPagesFor } from './exportPdf.testHelpers'
import type { PageMeta, TextFormField } from '../../shared/types'

async function fixtureWithTextField(): Promise<{ bytes: Uint8Array; doc: PDFDocument }> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([300, 300])
  const form = doc.getForm()
  const field = form.createTextField('name')
  field.addToPage(page, { x: 10, y: 10, width: 100, height: 20 })
  return { bytes: await doc.save(), doc }
}

function textFieldValue(name: string, value: string): TextFormField {
  return { name, type: 'text', value, readOnly: false, required: false, multiline: false, maxLength: null }
}

describe('isIdentityPageList', () => {
  it('is true for a fresh openFile-shaped list', () => {
    const pages: PageMeta[] = [
      { index: 0, source: { kind: 'original', sourcePageNumber: 1 }, widthPt: 300, heightPt: 300, rotation: 0, deleted: false },
      { index: 1, source: { kind: 'original', sourcePageNumber: 2 }, widthPt: 300, heightPt: 300, rotation: 0, deleted: false }
    ]
    expect(isIdentityPageList(pages, 2)).toBe(true)
  })

  it('is false when the page count differs', () => {
    const pages: PageMeta[] = [
      { index: 0, source: { kind: 'original', sourcePageNumber: 1 }, widthPt: 300, heightPt: 300, rotation: 0, deleted: false }
    ]
    expect(isIdentityPageList(pages, 2)).toBe(false)
  })

  it('is false for a deleted page', () => {
    const pages: PageMeta[] = [
      { index: 0, source: { kind: 'original', sourcePageNumber: 1 }, widthPt: 300, heightPt: 300, rotation: 0, deleted: true }
    ]
    expect(isIdentityPageList(pages, 1)).toBe(false)
  })

  it('is false for a rotated page', () => {
    const pages: PageMeta[] = [
      { index: 0, source: { kind: 'original', sourcePageNumber: 1 }, widthPt: 300, heightPt: 300, rotation: 90, deleted: false }
    ]
    expect(isIdentityPageList(pages, 1)).toBe(false)
  })

  it('is false for a blank or imported page', () => {
    const blank: PageMeta[] = [{ index: 0, source: { kind: 'blank' }, widthPt: 300, heightPt: 300, rotation: 0, deleted: false }]
    expect(isIdentityPageList(blank, 1)).toBe(false)

    const imported: PageMeta[] = [
      { index: 0, source: { kind: 'imported', importId: 'a', sourcePageNumber: 1 }, widthPt: 300, heightPt: 300, rotation: 0, deleted: false }
    ]
    expect(isIdentityPageList(imported, 1)).toBe(false)
  })

  it('is false for a reordered list, even with the same set of pages', () => {
    const pages: PageMeta[] = [
      { index: 1, source: { kind: 'original', sourcePageNumber: 2 }, widthPt: 300, heightPt: 300, rotation: 0, deleted: false },
      { index: 0, source: { kind: 'original', sourcePageNumber: 1 }, widthPt: 300, heightPt: 300, rotation: 0, deleted: false }
    ]
    expect(isIdentityPageList(pages, 2)).toBe(false)
  })
})

describe('exportPdf: form fields', () => {
  it('keeps a filled field genuinely fillable when the page list is untouched', async () => {
    const { bytes, doc } = await fixtureWithTextField()
    const pages = identityPagesFor(doc)

    const result = await exportPdf(bytes, {}, pages, {}, [textFieldValue('name', 'Ada')], false, null)

    expect(result.forcedFlatten).toBe(false)
    const reloaded = await PDFDocument.load(result.bytes)
    const fields = reloaded.getForm().getFields()
    expect(fields).toHaveLength(1)
    expect(reloaded.getForm().getTextField('name').getText()).toBe('Ada')
  })

  it('force-flattens a filled field when the page list has been modified and flatten was not requested', async () => {
    const { doc } = await fixtureWithTextField()
    // A second, unreferenced source page makes this a non-identity list
    // (isIdentityPageList requires the pages list to match the source's own
    // page count), forcing the fresh-document reconstruction path.
    doc.addPage([300, 300])
    const rebuiltBytes = await doc.save()
    const pages: PageMeta[] = [
      { index: 0, source: { kind: 'original', sourcePageNumber: 1 }, widthPt: 300, heightPt: 300, rotation: 0, deleted: false }
    ]

    const result = await exportPdf(rebuiltBytes, {}, pages, {}, [textFieldValue('name', 'Ada')], false, null)

    expect(result.forcedFlatten).toBe(true)
    const reloaded = await PDFDocument.load(result.bytes)
    expect(reloaded.getForm().getFields()).toHaveLength(0)
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('does not force-flatten when the user already asked for flatten explicitly', async () => {
    const { bytes, doc } = await fixtureWithTextField()
    const pages = identityPagesFor(doc)

    const result = await exportPdf(bytes, {}, pages, {}, [textFieldValue('name', 'Ada')], true, null)

    expect(result.forcedFlatten).toBe(false) // the caller asked for it, so it isn't "forced"
    const reloaded = await PDFDocument.load(result.bytes)
    expect(reloaded.getForm().getFields()).toHaveLength(0)
  })

  it('flatten never throws on a formless document', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([300, 300])
    const bytes = await doc.save()

    await expect(exportPdf(bytes, {}, identityPagesFor(doc), {}, [], true, null)).resolves.toBeDefined()
  })
})
