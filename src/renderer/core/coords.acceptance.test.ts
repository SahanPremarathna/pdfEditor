/**
 * The spec's §4 required acceptance test for the coordinate core: place text
 * at a known top-left point, export via pdf-lib, reopen via pdfjs-dist, and
 * confirm the recovered position matches within ±0.5pt. Covers rotation and
 * CropBox != MediaBox per spec §4 — do not proceed to Phase 3 until this passes.
 *
 * This is a hand-rolled write/read round trip, not the real export pipeline
 * (exportPdf.ts is Phase 4) — kept deliberately minimal and separate from
 * coords.test.ts's pure-math cases since it exercises real pdf-lib/pdfjs-dist.
 */
import { join } from 'node:path'
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { describe, expect, it } from 'vitest'
import { baselineOriginToTopLeft, textBaselineOrigin, type PageRotation } from './coords'
import { createFontRegistry } from './fonts'
import type { Point, Rect } from '../../shared/types'

// pdf-lib's standard fonts are referenced by name, not embedded as font program
// bytes, so pdf.js needs its own bundled glyph-metrics data to interpret them
// when reading the file back — only relevant to this Node-side test harness.
const standardFontDataUrl = join(__dirname, '..', '..', '..', 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/'

interface PlaceAndReadBackOptions {
  mediaBoxSize: { width: number; height: number }
  cropBox: Rect
  rotation: PageRotation
  topLeft: Point
  fontSize: number
  text: string
}

async function placeAndReadBackText(opts: PlaceAndReadBackOptions): Promise<Point> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([opts.mediaBoxSize.width, opts.mediaBoxSize.height])
  page.setCropBox(opts.cropBox.x, opts.cropBox.y, opts.cropBox.width, opts.cropBox.height)
  page.setRotation(degrees(opts.rotation))

  const registry = createFontRegistry(doc)
  const font = registry.embedStandard(StandardFonts.Helvetica)
  const ascentPt = font.heightAtSize(opts.fontSize, { descender: false })

  const origin = textBaselineOrigin(opts.topLeft, ascentPt, opts.cropBox, opts.rotation)
  page.drawText(opts.text, { x: origin.x, y: origin.y, size: opts.fontSize, font })

  const bytes = await doc.save()

  const readDoc = await getDocument({ data: bytes, standardFontDataUrl }).promise
  const readPage = await readDoc.getPage(1)
  const content = await readPage.getTextContent()
  const item = content.items[0] as TextItem

  // item.transform is in the page's raw (unrotated) content-stream space —
  // the same space textBaselineOrigin's output targets — NOT the rotated
  // viewport space. Do not run this through viewport.transform first: that
  // would apply pdf.js's own rotation/flip on top of baselineOriginToTopLeft's,
  // double-correcting for rotation.
  const rawBaseline: Point = { x: item.transform[4], y: item.transform[5] }

  return baselineOriginToTopLeft(rawBaseline, ascentPt, opts.cropBox, opts.rotation)
}

const A4 = { width: 595.28, height: 841.89 }

describe('coordinate core acceptance test (spec §4)', () => {
  it('case A: A4, CropBox = MediaBox, rotation 0 — 12pt text at (72,72)', async () => {
    const recovered = await placeAndReadBackText({
      mediaBoxSize: A4,
      cropBox: { x: 0, y: 0, width: A4.width, height: A4.height },
      rotation: 0,
      topLeft: { x: 72, y: 72 },
      fontSize: 12,
      text: 'Hello'
    })

    expect(recovered.x).toBeCloseTo(72, 0)
    expect(recovered.y).toBeCloseTo(72, 0)
  })

  it('case B: /Rotate 90 — 12pt text at (72,72) in the rotated viewport', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([A4.width, A4.height])
    page.setRotation(degrees(90))
    // sanity check: pdf.js reports the rotated (swapped) viewport size
    const bytes = await doc.save()
    const readDoc = await getDocument({ data: bytes, standardFontDataUrl }).promise
    const readPage = await readDoc.getPage(1)
    const viewport = readPage.getViewport({ scale: 1 })
    expect(viewport.width).toBeCloseTo(A4.height, 0)
    expect(viewport.height).toBeCloseTo(A4.width, 0)

    const recovered = await placeAndReadBackText({
      mediaBoxSize: A4,
      cropBox: { x: 0, y: 0, width: A4.width, height: A4.height },
      rotation: 90,
      topLeft: { x: 72, y: 72 },
      fontSize: 12,
      text: 'Hello'
    })

    expect(recovered.x).toBeCloseTo(72, 0)
    expect(recovered.y).toBeCloseTo(72, 0)
  })

  it('case C: CropBox != MediaBox (offset inset) — 12pt text at (72,72) relative to the CropBox', async () => {
    const mediaBoxSize = { width: 700, height: 900 }
    const cropBox: Rect = { x: 50, y: 60, width: A4.width, height: A4.height }

    const recovered = await placeAndReadBackText({
      mediaBoxSize,
      cropBox,
      rotation: 0,
      topLeft: { x: 72, y: 72 },
      fontSize: 12,
      text: 'Hello'
    })

    expect(recovered.x).toBeCloseTo(72, 0)
    expect(recovered.y).toBeCloseTo(72, 0)
  })

  it('case D (bonus): rotation 90 combined with CropBox != MediaBox', async () => {
    const mediaBoxSize = { width: 700, height: 900 }
    const cropBox: Rect = { x: 50, y: 60, width: A4.width, height: A4.height }

    const recovered = await placeAndReadBackText({
      mediaBoxSize,
      cropBox,
      rotation: 90,
      topLeft: { x: 72, y: 72 },
      fontSize: 12,
      text: 'Hello'
    })

    expect(recovered.x).toBeCloseTo(72, 0)
    expect(recovered.y).toBeCloseTo(72, 0)
  })
})
