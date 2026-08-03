import { degrees, PDFDocument, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import { hexToRgbColor } from './colors'
import { normalizeRotation, objectRotationToDrawRotation, rotatedObjectPoint, type CropBox, type PageRotation } from './coords'
import { normalizeFontFamily, type OnScreenFontFamily } from './fontFamilies'
import { createFontRegistry } from './fonts'
import { wrapText } from './textWrap'
import type { TextObject } from '../../shared/types'

/**
 * Translates a raw pdf-lib load error into a message safe to show the user.
 *
 * Checks `err.message` rather than `err instanceof EncryptedPDFError`:
 * pdf-lib's error classes are TypeScript classes downlevel-compiled to ES5
 * `tslib.__extends(..., Error)`, which does not fix up the prototype chain
 * for a built-in like Error — verified directly that even
 * `new EncryptedPDFError() instanceof EncryptedPDFError` is `false` in this
 * pdf-lib build, and `.name`/`.constructor.name` both collapse to plain
 * `"Error"` too. The error's `message` text is the one stable signal left.
 */
export function toExportError(err: unknown): Error {
  if (err instanceof Error && /is encrypted/i.test(err.message)) {
    return new Error("This PDF is password-protected and can't be saved by Inkline yet.")
  }
  return err instanceof Error ? err : new Error('Failed to export PDF')
}

const STANDARD_FONTS_BY_FAMILY: Record<
  OnScreenFontFamily,
  { regular: StandardFonts; bold: StandardFonts; italic: StandardFonts; boldItalic: StandardFonts }
> = {
  sans: {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique
  },
  serif: {
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic
  },
  mono: {
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    boldItalic: StandardFonts.CourierBoldOblique
  }
}

/** Resolves a TextObject's on-screen fontFamily + bold/italic flags to the
 *  matching pdf-lib StandardFonts member. No real TTFs are bundled yet
 *  (deferred past Phase 2/3), so export is WinAnsi-only via pdf-lib's 14
 *  built-in fonts — a known, already-flagged limitation, not fixed here. */
export function resolveStandardFont(family: string, bold: boolean, italic: boolean): StandardFonts {
  const variants = STANDARD_FONTS_BY_FAMILY[normalizeFontFamily(family)]
  if (bold && italic) return variants.boldItalic
  if (bold) return variants.bold
  if (italic) return variants.italic
  return variants.regular
}

function alignOffset(align: TextObject['align'], lineWidthPt: number, boxWidthPt: number): number {
  switch (align) {
    case 'left':
      return 0
    case 'center':
      return Math.max(0, (boxWidthPt - lineWidthPt) / 2)
    case 'right':
      return Math.max(0, boxWidthPt - lineWidthPt)
  }
}

function drawTextObject(
  page: PDFPage,
  obj: TextObject,
  font: PDFFont,
  cropBox: CropBox,
  pageRotation: PageRotation
): void {
  const ascentPt = font.heightAtSize(obj.fontSize, { descender: false })
  const lineHeightPt = obj.fontSize * obj.lineHeight
  const lines = wrapText(obj.text, obj.width, (s) => font.widthOfTextAtSize(s, obj.fontSize))
  const rotateDegrees = objectRotationToDrawRotation(obj.rotation, pageRotation)
  const color = hexToRgbColor(obj.color)

  lines.forEach((line, i) => {
    const lineWidthPt = font.widthOfTextAtSize(line, obj.fontSize)
    const localOffset = {
      x: alignOffset(obj.align, lineWidthPt, obj.width),
      y: ascentPt + i * lineHeightPt
    }
    const origin = rotatedObjectPoint({ x: obj.x, y: obj.y }, localOffset, obj.rotation, cropBox, pageRotation)

    page.drawText(line, {
      x: origin.x,
      y: origin.y,
      size: obj.fontSize,
      font,
      color,
      opacity: obj.opacity,
      rotate: degrees(rotateDegrees)
    })
  })
}

/**
 * Loads `originalBytes`, draws every TextObject in `objectsByPage` onto its
 * page (sorted by z, bottom-to-front), and returns the resulting PDF bytes.
 * Pure/renderer-safe — never touches fs/path/electron; the caller (main
 * process, via IPC) is responsible for actually writing the result to disk.
 */
export async function exportPdf(
  originalBytes: Uint8Array,
  objectsByPage: Record<number, TextObject[]>
): Promise<Uint8Array> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(originalBytes, { updateMetadata: false })
  } catch (err) {
    throw toExportError(err)
  }

  const registry = createFontRegistry(doc)
  const pageCount = doc.getPageCount()

  for (const [pageIndexKey, objects] of Object.entries(objectsByPage)) {
    const pageIndex = Number(pageIndexKey)
    if (pageIndex < 0 || pageIndex >= pageCount || objects.length === 0) continue

    const page = doc.getPage(pageIndex)
    const cropBox = page.getCropBox()
    const pageRotation = normalizeRotation(page.getRotation().angle)

    const sorted = [...objects].sort((a, b) => a.z - b.z)
    for (const obj of sorted) {
      const font = registry.embedStandard(resolveStandardFont(obj.fontFamily, obj.bold, obj.italic))
      drawTextObject(page, obj, font, cropBox, pageRotation)
    }
  }

  return doc.save()
}
