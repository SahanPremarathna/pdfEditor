/**
 * Extends coords.acceptance.test.ts's real pdf-lib(write)/pdfjs-dist(read)
 * round-trip pattern to exercise the production exportPdf() function itself,
 * now covering what Phase 2's acceptance test never needed to: a TEXT
 * OBJECT'S OWN rotation composed with the page's /Rotate. A position-only
 * assertion would miss a wrong-angle bug entirely, since drawText's `x,y`
 * and `rotate` are independent — so every case here checks recovered
 * ROTATION as well as recovered POSITION.
 */
import { join } from 'node:path'
import { degrees, PDFDocument, StandardFonts } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { describe, expect, it } from 'vitest'
import { objectRotationToDrawRotation, rotatedObjectPoint, type PageRotation } from './coords'
import { exportPdf } from './exportPdf'
import { createTextObject } from './objects'
import type { Rect, TextObject } from '../../shared/types'

const standardFontDataUrl = join(__dirname, '..', '..', '..', 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/'

const A4 = { width: 595.28, height: 841.89 }

interface ReadBackLine {
  text: string
  x: number
  y: number
  rotationDeg: number
}

async function exportAndReadBack(
  mediaBoxSize: { width: number; height: number },
  cropBox: Rect,
  rotation: PageRotation,
  obj: TextObject
): Promise<ReadBackLine[]> {
  const sourceDoc = await PDFDocument.create()
  const page = sourceDoc.addPage([mediaBoxSize.width, mediaBoxSize.height])
  page.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height)
  page.setRotation(degrees(rotation))
  const sourceBytes = await sourceDoc.save()

  const exportedBytes = await exportPdf(sourceBytes, { [obj.pageIndex]: [obj] })

  const readDoc = await getDocument({ data: exportedBytes, standardFontDataUrl }).promise
  const readPage = await readDoc.getPage(obj.pageIndex + 1)
  const content = await readPage.getTextContent()

  return (content.items as TextItem[]).map((item) => {
    const [a, b, , , e, f] = item.transform
    return {
      text: item.str,
      x: e,
      y: f,
      rotationDeg: (Math.atan2(b, a) * 180) / Math.PI
    }
  })
}

describe('exportPdf acceptance: object rotation composed with page rotation', () => {
  it('case A: rotated (30deg), bold, wrapped two-line object on a /Rotate 90 page with an offset CropBox', async () => {
    const mediaBoxSize = { width: 700, height: 900 }
    const cropBox: Rect = { x: 50, y: 60, width: A4.width, height: A4.height }
    const pageRotation: PageRotation = 90
    const objectRotationDeg = 30

    const obj = createTextObject(
      0,
      72,
      72,
      0,
      {
        text: 'Line one\nLine two',
        width: 300,
        fontSize: 14,
        lineHeight: 1.2,
        bold: true,
        rotation: objectRotationDeg,
        color: '#3366cc',
        align: 'left'
      },
      () => 'obj-a'
    )

    const lines = await exportAndReadBack(mediaBoxSize, cropBox, pageRotation, obj)
    expect(lines).toHaveLength(2)
    expect(lines[0].text).toBe('Line one')
    expect(lines[1].text).toBe('Line two')

    // Independently compute the expected per-line origin the same way exportPdf.ts does,
    // using the SAME font metrics (bold Helvetica) so this isn't circular against the
    // production code's own font resolution.
    const doc = await PDFDocument.create()
    const font = doc.embedStandardFont(StandardFonts.HelveticaBold)
    const ascentPt = font.heightAtSize(obj.fontSize, { descender: false })
    const lineHeightPt = obj.fontSize * obj.lineHeight
    const expectedRotation = objectRotationToDrawRotation(objectRotationDeg, pageRotation)

    for (let i = 0; i < 2; i++) {
      const expectedOrigin = rotatedObjectPoint(
        { x: obj.x, y: obj.y },
        { x: 0, y: ascentPt + i * lineHeightPt },
        objectRotationDeg,
        cropBox,
        pageRotation
      )
      expect(lines[i].x).toBeCloseTo(expectedOrigin.x, 1)
      expect(lines[i].y).toBeCloseTo(expectedOrigin.y, 1)
      expect(lines[i].rotationDeg).toBeCloseTo(expectedRotation, 1)
    }
  })

  it('case B (sanity check b): unrotated object on a /Rotate 90 page still needs a 90deg draw rotation', async () => {
    const cropBox: Rect = { x: 0, y: 0, width: A4.width, height: A4.height }
    const pageRotation: PageRotation = 90

    const obj = createTextObject(
      0,
      72,
      72,
      0,
      { text: 'Upright', width: 200, fontSize: 12, rotation: 0, align: 'left' },
      () => 'obj-b'
    )

    const lines = await exportAndReadBack(A4, cropBox, pageRotation, obj)
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('Upright')
    expect(lines[0].rotationDeg).toBeCloseTo(90, 1)

    const doc = await PDFDocument.create()
    const font = doc.embedStandardFont(StandardFonts.Helvetica)
    const ascentPt = font.heightAtSize(obj.fontSize, { descender: false })
    const expectedOrigin = rotatedObjectPoint({ x: 72, y: 72 }, { x: 0, y: ascentPt }, 0, cropBox, pageRotation)
    expect(lines[0].x).toBeCloseTo(expectedOrigin.x, 1)
    expect(lines[0].y).toBeCloseTo(expectedOrigin.y, 1)
  })

  it('case C: unrotated object on an unrotated page still matches plain baseline placement', async () => {
    const cropBox: Rect = { x: 0, y: 0, width: A4.width, height: A4.height }

    const obj = createTextObject(
      0,
      72,
      72,
      0,
      { text: 'Hello', width: 200, fontSize: 12, rotation: 0, align: 'left' },
      () => 'obj-c'
    )

    const lines = await exportAndReadBack(A4, cropBox, 0, obj)
    expect(lines).toHaveLength(1)
    expect(lines[0].rotationDeg).toBeCloseTo(0, 1)
  })
})
