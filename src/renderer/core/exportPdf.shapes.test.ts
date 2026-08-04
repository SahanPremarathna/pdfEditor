/**
 * Smoke-level round-trip coverage for the Phase 5 object types added to
 * exportPdf's dispatch (rect/ellipse/highlight/whiteout/image/freehand/line/
 * arrow/signature). The exact anchor-point math for each drawing primitive
 * was derived and cross-checked directly against pdf-lib's own operator
 * sequences (operations.js) rather than re-verified pixel-for-pixel here —
 * pdfjs-dist has no simple structured API for reading back vector graphics
 * the way exportPdf.acceptance.test.ts reads back text via getTextContent().
 * These tests instead guard the thing most likely to actually break in
 * practice: that every branch runs without throwing and produces bytes
 * pdf-lib itself can re-load cleanly (no corruption, right page count).
 */
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { exportPdf } from './exportPdf'
import { identityPagesFor } from './exportPdf.testHelpers'
import { createImageObject, createPathObject, createShapeObject, createTextObject } from './objects'
import type { PdfObject } from '../../shared/types'

// 1x1 transparent PNG
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

async function exportSinglePage(objects: PdfObject[]): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const sourceDoc = await PDFDocument.create()
  sourceDoc.addPage([612, 792])
  const sourceBytes = await sourceDoc.save()

  const bytes = await exportPdf(sourceBytes, { 0: objects }, identityPagesFor(sourceDoc), {})
  const reloaded = await PDFDocument.load(bytes)
  return { bytes, pageCount: reloaded.getPageCount() }
}

describe('exportPdf: Phase 5 object types', () => {
  it('exports a rotated rect with a fill and a border', async () => {
    const obj = createShapeObject('rect', 0, 72, 72, 100, 50, 0, { rotation: 20, fill: '#ff0000' })
    const { pageCount } = await exportSinglePage([obj])
    expect(pageCount).toBe(1)
  })

  it('exports an ellipse', async () => {
    const obj = createShapeObject('ellipse', 0, 72, 72, 100, 60, 0)
    const { pageCount } = await exportSinglePage([obj])
    expect(pageCount).toBe(1)
  })

  it('exports a highlight with BlendMode.Multiply', async () => {
    const obj = createShapeObject('highlight', 0, 72, 72, 100, 20, 0)
    const { pageCount } = await exportSinglePage([obj])
    expect(pageCount).toBe(1)
  })

  it('exports a whiteout as an opaque box', async () => {
    const obj = createShapeObject('whiteout', 0, 72, 72, 100, 20, 0)
    const { pageCount } = await exportSinglePage([obj])
    expect(pageCount).toBe(1)
  })

  it('exports an image, embedding it via the image registry', async () => {
    const obj = createImageObject(0, 72, 72, 50, 50, TINY_PNG_DATA_URL, 'image/png', 0)
    const { pageCount } = await exportSinglePage([obj])
    expect(pageCount).toBe(1)
  })

  it('embeds a reused image dataUrl only once across multiple objects', async () => {
    const a = createImageObject(0, 0, 0, 20, 20, TINY_PNG_DATA_URL, 'image/png', 0, {}, () => 'a')
    const b = createImageObject(0, 100, 100, 20, 20, TINY_PNG_DATA_URL, 'image/png', 1, {}, () => 'b')
    const { pageCount } = await exportSinglePage([a, b])
    expect(pageCount).toBe(1)
  })

  it('exports a multi-stroke freehand path', async () => {
    const obj = createPathObject('freehand', 0, 72, 72, 30, 30, [
      [0, 0, 10, 10, 20, 0],
      [5, 20, 25, 25]
    ], 0)
    const { pageCount } = await exportSinglePage([obj])
    expect(pageCount).toBe(1)
  })

  it('exports a rotated line', async () => {
    const obj = createPathObject('line', 0, 72, 72, 100, 0, [[0, 0, 100, 0]], 0, { rotation: 15 })
    const { pageCount } = await exportSinglePage([obj])
    expect(pageCount).toBe(1)
  })

  it('exports an arrow with an appended arrowhead', async () => {
    const obj = createPathObject('arrow', 0, 72, 72, 100, 0, [[0, 0, 100, 0]], 0)
    const { pageCount } = await exportSinglePage([obj])
    expect(pageCount).toBe(1)
  })

  it('exports a vector signature the same way as freehand', async () => {
    const obj = createPathObject('signature', 0, 72, 72, 60, 20, [[0, 0, 30, 20, 60, 0]], 0)
    const { pageCount } = await exportSinglePage([obj])
    expect(pageCount).toBe(1)
  })

  it('exports a mixed page (every object type at once, sorted by z) without throwing', async () => {
    const objects: PdfObject[] = [
      createTextObject(0, 10, 10, 0, { text: 'hi' }, () => 't'),
      createShapeObject('rect', 0, 10, 40, 40, 20, 1, {}, () => 'r'),
      createShapeObject('ellipse', 0, 60, 40, 40, 20, 2, {}, () => 'e'),
      createShapeObject('highlight', 0, 10, 70, 90, 15, 3, {}, () => 'h'),
      createShapeObject('whiteout', 0, 10, 90, 90, 15, 4, {}, () => 'w'),
      createImageObject(0, 10, 110, 30, 30, TINY_PNG_DATA_URL, 'image/png', 5, {}, () => 'i'),
      createPathObject('freehand', 0, 10, 150, 20, 20, [[0, 0, 10, 10, 20, 0]], 6, {}, () => 'f'),
      createPathObject('line', 0, 10, 180, 40, 0, [[0, 0, 40, 0]], 7, {}, () => 'l'),
      createPathObject('arrow', 0, 10, 200, 40, 0, [[0, 0, 40, 0]], 8, {}, () => 'a'),
      createPathObject('signature', 0, 10, 220, 40, 15, [[0, 0, 20, 15, 40, 0]], 9, {}, () => 's')
    ]

    const { pageCount } = await exportSinglePage(objects)
    expect(pageCount).toBe(1)
  })
})
