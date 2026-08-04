/**
 * Real pdf-lib(write)/pdfjs-dist(read) round-trip coverage for the watermark
 * fork exportPdf.ts added: a shared WatermarkConfig, resolved per-page via
 * viewportSize() and drawn through the same drawTextObject/drawImageObject
 * used for ordinary objects. Follows exportPdf.acceptance.test.ts's technique
 * (read back via pdfjs getTextContent(), cross-check position/rotation via
 * the same rotatedObjectPoint the production code itself uses) plus
 * exportPdf.pageOps.test.ts's page-range style multi-page fixtures.
 */
import { degrees, PDFDocument, StandardFonts } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { objectRotationToDrawRotation, rotatedObjectPoint, viewportSize, type CropBox } from './coords'
import { exportPdf } from './exportPdf'
import { identityPagesFor } from './exportPdf.testHelpers'
import type { ImageWatermarkConfig, TextWatermarkConfig } from '../../shared/types'

const standardFontDataUrl = join(__dirname, '..', '..', '..', 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/'

// 1x1 transparent PNG
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function textWatermark(overrides: Partial<TextWatermarkConfig> = {}): TextWatermarkConfig {
  return {
    type: 'text',
    enabled: true,
    xFraction: 0.5,
    yFraction: 0.5,
    rotationDeg: 0,
    opacity: 0.3,
    pageIndices: [],
    rangeInput: null,
    text: 'CONFIDENTIAL',
    fontFamily: 'sans',
    // Kept small relative to the 300x400 test page fixtures below: pdfjs-dist's
    // getTextContent (used to read the export back) truncates a text run that
    // extends past the page's own width — verified directly as a pdfjs
    // extraction quirk, not a production drawText/exportPdf bug — so a large
    // watermark-sized font on a small test page would silently corrupt these
    // assertions rather than the export itself.
    fontSize: 14,
    color: '#ff0000',
    ...overrides
  }
}

function imageWatermark(overrides: Partial<ImageWatermarkConfig> = {}): ImageWatermarkConfig {
  return {
    type: 'image',
    enabled: true,
    xFraction: 0.5,
    yFraction: 0.5,
    rotationDeg: 0,
    opacity: 0.3,
    pageIndices: [],
    rangeInput: null,
    dataUrl: TINY_PNG_DATA_URL,
    mime: 'image/png',
    naturalWidth: 40,
    naturalHeight: 40,
    scale: 1,
    ...overrides
  }
}

/** pdfjs-dist detaches the `data` buffer it's handed on the first
 *  getDocument() call — passing the same Uint8Array into a second call fails
 *  with a DataCloneError — so callers that need multiple pages' text load the
 *  document once via this and read pages off the single resulting proxy. */
async function loadTextByPage(bytes: Uint8Array): Promise<(pageNumber1Indexed: number) => Promise<string[]>> {
  const readDoc = await getDocument({ data: bytes, standardFontDataUrl }).promise
  return async (pageNumber1Indexed: number) => {
    const readPage = await readDoc.getPage(pageNumber1Indexed)
    const content = await readPage.getTextContent()
    return (content.items as TextItem[]).map((item) => item.str)
  }
}

describe('exportPdf: watermark', () => {
  it('draws a text watermark only on pages within pageIndices, leaving others untouched', async () => {
    const sourceDoc = await PDFDocument.create()
    sourceDoc.addPage([300, 400])
    sourceDoc.addPage([300, 400])
    sourceDoc.addPage([300, 400])
    const sourceBytes = await sourceDoc.save()
    const pages = identityPagesFor(sourceDoc)

    const watermark = textWatermark({ pageIndices: [0, 2] })
    const { bytes } = await exportPdf(sourceBytes, {}, pages, {}, [], false, watermark)

    const textOnPage = await loadTextByPage(bytes)
    expect(await textOnPage(1)).toContain('CONFIDENTIAL')
    expect(await textOnPage(2)).not.toContain('CONFIDENTIAL')
    expect(await textOnPage(3)).toContain('CONFIDENTIAL')
  })

  it('does not draw anything when the config is disabled', async () => {
    const sourceDoc = await PDFDocument.create()
    sourceDoc.addPage([300, 400])
    const sourceBytes = await sourceDoc.save()
    const pages = identityPagesFor(sourceDoc)

    const watermark = textWatermark({ enabled: false, pageIndices: [0] })
    const { bytes } = await exportPdf(sourceBytes, {}, pages, {}, [], false, watermark)

    const textOnPage = await loadTextByPage(bytes)
    expect(await textOnPage(1)).not.toContain('CONFIDENTIAL')
  })

  it('resolves xFraction/yFraction against the page size at rotationDeg 0, matching direct math', async () => {
    const sourceDoc = await PDFDocument.create()
    sourceDoc.addPage([300, 400])
    const sourceBytes = await sourceDoc.save()
    const pages = identityPagesFor(sourceDoc)

    const watermark = textWatermark({ pageIndices: [0], xFraction: 0.25, yFraction: 0.75, rotationDeg: 0 })
    const { bytes } = await exportPdf(sourceBytes, {}, pages, {}, [], false, watermark)

    const readDoc = await getDocument({ data: bytes, standardFontDataUrl }).promise
    const readPage = await readDoc.getPage(1)
    const content = await readPage.getTextContent()
    const item = (content.items as TextItem[])[0]
    const [, , , , e, f] = item.transform

    const cropBox: CropBox = { x: 0, y: 0, width: 300, height: 400 }
    const x = 0.25 * 300
    const y = 0.75 * 400

    const doc = await PDFDocument.create()
    const font = doc.embedStandardFont(StandardFonts.Helvetica)
    const ascentPt = font.heightAtSize(watermark.fontSize, { descender: false })
    const expectedOrigin = rotatedObjectPoint({ x, y }, { x: 0, y: ascentPt }, 0, cropBox, 0)

    expect(e).toBeCloseTo(expectedOrigin.x, 1)
    expect(f).toBeCloseTo(expectedOrigin.y, 1)
  })

  it('composes watermark rotation with the page /Rotate, matching rotatedObjectPoint directly', async () => {
    const sourceDoc = await PDFDocument.create()
    const page = sourceDoc.addPage([300, 400])
    page.setRotation(degrees(90))
    const sourceBytes = await sourceDoc.save()
    const pages = identityPagesFor(sourceDoc)
    pages[0].rotation = 0 // isIdentityPageList requires PageMeta.rotation===0; the /Rotate lives on the source page itself

    const watermark = textWatermark({ pageIndices: [0], xFraction: 0.5, yFraction: 0.5, rotationDeg: 15 })
    const { bytes } = await exportPdf(sourceBytes, {}, pages, {}, [], false, watermark)

    const readDoc = await getDocument({ data: bytes, standardFontDataUrl }).promise
    const readPage = await readDoc.getPage(1)
    const content = await readPage.getTextContent()
    const item = (content.items as TextItem[])[0]
    const [a, b, , , e, f] = item.transform
    const rotationDeg = (Math.atan2(b, a) * 180) / Math.PI

    const cropBox: CropBox = { x: 0, y: 0, width: 300, height: 400 }
    const { width, height } = viewportSize(cropBox, 90)
    const x = 0.5 * width
    const y = 0.5 * height

    const doc = await PDFDocument.create()
    const font = doc.embedStandardFont(StandardFonts.Helvetica)
    const ascentPt = font.heightAtSize(watermark.fontSize, { descender: false })
    const expectedOrigin = rotatedObjectPoint({ x, y }, { x: 0, y: ascentPt }, 15, cropBox, 90)

    expect(e).toBeCloseTo(expectedOrigin.x, 1)
    expect(f).toBeCloseTo(expectedOrigin.y, 1)
    // Composition is pageRotation - objectRotationDeg (coords.ts's own
    // objectRotationToDrawRotation), not a naive sum — same cross-check
    // exportPdf.acceptance.test.ts uses for ordinary text objects.
    expect(rotationDeg).toBeCloseTo(objectRotationToDrawRotation(15, 90), 1)
  })

  it('exports an image watermark without corruption', async () => {
    const sourceDoc = await PDFDocument.create()
    sourceDoc.addPage([300, 400])
    const sourceBytes = await sourceDoc.save()
    const pages = identityPagesFor(sourceDoc)

    const watermark = imageWatermark({ pageIndices: [0] })
    const { bytes } = await exportPdf(sourceBytes, {}, pages, {}, [], false, watermark)

    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('skips a stale pageIndices entry that no longer exists, without throwing', async () => {
    const sourceDoc = await PDFDocument.create()
    sourceDoc.addPage([300, 400])
    const sourceBytes = await sourceDoc.save()
    const pages = identityPagesFor(sourceDoc)

    const watermark = textWatermark({ pageIndices: [0, 99] })
    await expect(exportPdf(sourceBytes, {}, pages, {}, [], false, watermark)).resolves.toBeDefined()
  })

  it('goes through the reconstruction fork (page ops applied) and still draws the watermark', async () => {
    const sourceDoc = await PDFDocument.create()
    sourceDoc.addPage([300, 400])
    sourceDoc.addPage([300, 400])
    const sourceBytes = await sourceDoc.save()

    // Deleting page 0 forces the non-identity reconstruction path.
    const pages = identityPagesFor(sourceDoc)
    pages[0].deleted = true

    const watermark = textWatermark({ pageIndices: [1] })
    const { bytes } = await exportPdf(sourceBytes, {}, pages, {}, [], false, watermark)

    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(1)
    const textOnPage = await loadTextByPage(bytes)
    expect(await textOnPage(1)).toContain('CONFIDENTIAL')
  })
})
