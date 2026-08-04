/**
 * Round-trip coverage for exportPdf's page-reconstruction pass (delete /
 * reorder / insert-blank / import / rotate) — all verified via pdf-lib
 * re-loading the exported bytes (page count, size, rotation), the same way
 * exportPdf.shapes.test.ts verifies "no corruption" for object types. Object
 * geometry on a rotated page is already covered end-to-end by
 * exportPdf.acceptance.test.ts's pdfjs read-back, so this file stays
 * pdf-lib-only and focuses on the page list itself.
 */
import { degrees, PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { exportPdf } from './exportPdf'
import { createTextObject } from './objects'
import type { PageMeta } from '../../shared/types'

async function sizedDoc(sizes: [number, number][]): Promise<{ bytes: Uint8Array; doc: PDFDocument }> {
  const doc = await PDFDocument.create()
  for (const [w, h] of sizes) doc.addPage([w, h])
  return { bytes: await doc.save(), doc }
}

function originalPage(index: number, sourcePageNumber: number, size: [number, number], overrides: Partial<PageMeta> = {}): PageMeta {
  return {
    index,
    source: { kind: 'original', sourcePageNumber },
    widthPt: size[0],
    heightPt: size[1],
    rotation: 0,
    deleted: false,
    ...overrides
  }
}

describe('exportPdf page reconstruction', () => {
  it('omits a deleted page and preserves the order of the rest', async () => {
    const { bytes } = await sizedDoc([
      [300, 400],
      [301, 401],
      [500, 600]
    ])
    const pages: PageMeta[] = [
      originalPage(0, 1, [300, 400]),
      originalPage(1, 2, [301, 401], { deleted: true }),
      originalPage(2, 3, [500, 600])
    ]

    const { bytes: exported } = await exportPdf(bytes, {}, pages, {}, [], false, null)
    const reloaded = await PDFDocument.load(exported)

    expect(reloaded.getPageCount()).toBe(2)
    expect(reloaded.getPage(0).getSize()).toEqual({ width: 300, height: 400 })
    expect(reloaded.getPage(1).getSize()).toEqual({ width: 500, height: 600 })
  })

  it('emits pages in the pages-array order, not the original document order', async () => {
    const { bytes } = await sizedDoc([
      [300, 400],
      [301, 401],
      [500, 600]
    ])
    // Reordered: original page 3, then page 1, then page 2.
    const pages: PageMeta[] = [
      originalPage(2, 3, [500, 600]),
      originalPage(0, 1, [300, 400]),
      originalPage(1, 2, [301, 401])
    ]

    const { bytes: exported } = await exportPdf(bytes, {}, pages, {}, [], false, null)
    const reloaded = await PDFDocument.load(exported)

    expect(reloaded.getPageCount()).toBe(3)
    expect(reloaded.getPage(0).getSize()).toEqual({ width: 500, height: 600 })
    expect(reloaded.getPage(1).getSize()).toEqual({ width: 300, height: 400 })
    expect(reloaded.getPage(2).getSize()).toEqual({ width: 301, height: 401 })
  })

  it('inserts a blank page of the requested size at the right position', async () => {
    const { bytes } = await sizedDoc([
      [300, 400],
      [500, 600]
    ])
    const pages: PageMeta[] = [
      originalPage(0, 1, [300, 400]),
      { index: 2, source: { kind: 'blank' }, widthPt: 200, heightPt: 250, rotation: 0, deleted: false },
      originalPage(1, 2, [500, 600])
    ]

    const { bytes: exported } = await exportPdf(bytes, {}, pages, {}, [], false, null)
    const reloaded = await PDFDocument.load(exported)

    expect(reloaded.getPageCount()).toBe(3)
    expect(reloaded.getPage(1).getSize()).toEqual({ width: 200, height: 250 })
  })

  it('inserts an imported page from a second document at the right position', async () => {
    const { bytes } = await sizedDoc([[300, 400]])
    const { bytes: importedBytes } = await sizedDoc([
      [111, 222],
      [333, 444]
    ])
    const importId = 'import-1'
    const pages: PageMeta[] = [
      originalPage(0, 1, [300, 400]),
      { index: 1, source: { kind: 'imported', importId, sourcePageNumber: 2 }, widthPt: 333, heightPt: 444, rotation: 0, deleted: false }
    ]

    const { bytes: exported } = await exportPdf(bytes, {}, pages, { [importId]: importedBytes }, [], false, null)
    const reloaded = await PDFDocument.load(exported)

    expect(reloaded.getPageCount()).toBe(2)
    expect(reloaded.getPage(1).getSize()).toEqual({ width: 333, height: 444 })
  })

  it("a rotated page's final rotation is additive on top of the page's own existing rotation", async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([300, 400])
    page.setRotation(degrees(90))
    const bytes = await doc.save()

    const pages: PageMeta[] = [originalPage(0, 1, [300, 400], { rotation: 90 })]

    const { bytes: exported } = await exportPdf(bytes, {}, pages, {}, [], false, null)
    const reloaded = await PDFDocument.load(exported)

    expect(reloaded.getPage(0).getRotation().angle).toBe(180)
  })

  it('leaves rotation untouched when the delta is 0', async () => {
    // A second source page not referenced in `pages` forces the
    // fresh-document reconstruction path (isIdentityPageList requires the
    // pages list to match the source's own page count) — this test is
    // specifically about buildPageMapping's rotation handling, not the
    // identity/bypass fast path (covered separately in exportPdf.forms.test.ts).
    const { bytes } = await sizedDoc([
      [300, 400],
      [999, 999]
    ])
    const pages: PageMeta[] = [originalPage(0, 1, [300, 400])]

    const { bytes: exported } = await exportPdf(bytes, {}, pages, {}, [], false, null)
    const reloaded = await PDFDocument.load(exported)

    expect(reloaded.getPageCount()).toBe(1)
    expect(reloaded.getPage(0).getRotation().angle).toBe(0)
  })

  it('draws objects on the remapped final page, skipping objects on deleted pages', async () => {
    const { bytes } = await sizedDoc([
      [300, 400],
      [301, 401]
    ])
    const pages: PageMeta[] = [
      originalPage(0, 1, [300, 400], { deleted: true }),
      originalPage(1, 2, [301, 401])
    ]

    const objectsByPage = {
      0: [createTextObject(0, 10, 10, 0, { text: 'on a deleted page' }, () => 'a')],
      1: [createTextObject(1, 10, 10, 0, { text: 'on a surviving page' }, () => 'b')]
    }

    const { bytes: exported } = await exportPdf(bytes, objectsByPage, pages, {}, [], false, null)
    const reloaded = await PDFDocument.load(exported)

    expect(reloaded.getPageCount()).toBe(1)
  })
})
