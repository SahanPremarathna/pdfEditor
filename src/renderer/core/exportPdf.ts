import { BlendMode, degrees, LineCapStyle, PDFDocument, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import { hexToRgbColor } from './colors'
import { normalizeRotation, objectRotationToDrawRotation, rotatedObjectPoint, type CropBox, type PageRotation } from './coords'
import { normalizeFontFamily, type OnScreenFontFamily } from './fontFamilies'
import { createFontRegistry } from './fonts'
import { createImageRegistry, type ImageRegistry } from './images'
import { wrapText } from './textWrap'
import type { ImageObject, PageMeta, PathObject, PdfObject, ShapeObject, TextObject } from '../../shared/types'

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
 * Draws a rect/ellipse/highlight/whiteout ShapeObject. pdf-lib's
 * drawRectangle/drawImage both anchor at the box's BOTTOM-LEFT corner and
 * grow up-right from (x,y) before `rotate` is applied (verified directly
 * against pdf-lib's operations.js); drawEllipse anchors at the CENTER. Both
 * are just a different `localOffset` into the same rotatedObjectPoint this
 * module already uses for text — no new coordinate math needed.
 */
function drawShapeObject(page: PDFPage, obj: ShapeObject, cropBox: CropBox, pageRotation: PageRotation): void {
  const rotateDegrees = degrees(objectRotationToDrawRotation(obj.rotation, pageRotation))
  const color = obj.fill ? hexToRgbColor(obj.fill) : undefined
  const borderColor = obj.stroke ? hexToRgbColor(obj.stroke) : undefined
  const blendMode = obj.type === 'highlight' ? BlendMode.Multiply : undefined

  if (obj.type === 'ellipse') {
    const center = rotatedObjectPoint(
      { x: obj.x, y: obj.y },
      { x: obj.width / 2, y: obj.height / 2 },
      obj.rotation,
      cropBox,
      pageRotation
    )
    page.drawEllipse({
      x: center.x,
      y: center.y,
      xScale: obj.width / 2,
      yScale: obj.height / 2,
      rotate: rotateDegrees,
      color,
      borderColor,
      borderWidth: obj.strokeWidth,
      opacity: obj.opacity
    })
    return
  }

  const bottomLeft = rotatedObjectPoint({ x: obj.x, y: obj.y }, { x: 0, y: obj.height }, obj.rotation, cropBox, pageRotation)
  page.drawRectangle({
    x: bottomLeft.x,
    y: bottomLeft.y,
    width: obj.width,
    height: obj.height,
    rotate: rotateDegrees,
    color,
    borderColor,
    borderWidth: obj.strokeWidth,
    opacity: obj.opacity,
    blendMode
  })
}

async function drawImageObject(
  page: PDFPage,
  obj: ImageObject,
  imageRegistry: ImageRegistry,
  cropBox: CropBox,
  pageRotation: PageRotation
): Promise<void> {
  const image = await imageRegistry.embed(obj.dataUrl, obj.mime)
  const bottomLeft = rotatedObjectPoint({ x: obj.x, y: obj.y }, { x: 0, y: obj.height }, obj.rotation, cropBox, pageRotation)
  page.drawImage(image, {
    x: bottomLeft.x,
    y: bottomLeft.y,
    width: obj.width,
    height: obj.height,
    rotate: degrees(objectRotationToDrawRotation(obj.rotation, pageRotation)),
    opacity: obj.opacity
  })
}

/** One `M x,y L x,y L x,y...` segment per stroke (a fresh `M` per pen-lift,
 *  so separate strokes aren't joined by a visible connecting line). */
function buildSvgPath(strokes: number[][]): string {
  return strokes
    .filter((stroke) => stroke.length >= 2)
    .map((stroke) => {
      const commands = [`M ${stroke[0]},${stroke[1]}`]
      for (let i = 2; i < stroke.length; i += 2) {
        commands.push(`L ${stroke[i]},${stroke[i + 1]}`)
      }
      return commands.join(' ')
    })
    .join(' ')
}

const ARROWHEAD_LENGTH_PT = 10
const ARROWHEAD_WING_ANGLE_RAD = (25 * Math.PI) / 180

/**
 * Two short "wing" segments forming a chevron at the tip of the last
 * stroke's final segment, angled off its direction — drawn as extra path
 * commands appended to the same SVG path string, so the whole thing rotates
 * and translates together as one drawSvgPath call. Returns '' if the last
 * stroke has fewer than 2 points (no direction to point the chevron along).
 */
export function arrowheadPath(strokes: number[][], sizePt: number = ARROWHEAD_LENGTH_PT): string {
  const lastStroke = strokes[strokes.length - 1]
  if (!lastStroke || lastStroke.length < 4) return ''

  const n = lastStroke.length
  const tipX = lastStroke[n - 2]
  const tipY = lastStroke[n - 1]
  const fromX = lastStroke[n - 4]
  const fromY = lastStroke[n - 3]

  const angle = Math.atan2(tipY - fromY, tipX - fromX)
  const wing = (sign: 1 | -1): { x: number; y: number } => {
    const wingAngle = angle + Math.PI - sign * ARROWHEAD_WING_ANGLE_RAD
    return { x: tipX + sizePt * Math.cos(wingAngle), y: tipY + sizePt * Math.sin(wingAngle) }
  }

  const left = wing(1)
  const right = wing(-1)
  return `M ${tipX},${tipY} L ${left.x},${left.y} M ${tipX},${tipY} L ${right.x},${right.y}`
}

/**
 * Draws freehand/line/arrow/signature — all one PathObject shape, all one
 * drawSvgPath call. drawSvgPath's own operator chain is translate(x,y) then
 * rotate then scale(1,-1) (verified in pdf-lib's operations.js) — the same
 * "flip is a reflection, so the composed angle needs objectRotationToDrawRotation"
 * reasoning coords.ts's docstring already derives for text applies unchanged
 * here, and the origin is the object's own top-left (localOffset {0,0}),
 * since drawSvgPath's `rotate` option — not the offset math — is what
 * applies the object's own rotation this time.
 */
function drawPathObject(page: PDFPage, obj: PathObject, cropBox: CropBox, pageRotation: PageRotation): void {
  const origin = rotatedObjectPoint({ x: obj.x, y: obj.y }, { x: 0, y: 0 }, obj.rotation, cropBox, pageRotation)

  let path = buildSvgPath(obj.points)
  if (obj.type === 'arrow') {
    const extra = arrowheadPath(obj.points)
    if (extra) path = `${path} ${extra}`
  }
  if (!path) return

  page.drawSvgPath(path, {
    x: origin.x,
    y: origin.y,
    rotate: degrees(objectRotationToDrawRotation(obj.rotation, pageRotation)),
    borderColor: hexToRgbColor(obj.stroke),
    borderWidth: obj.strokeWidth,
    borderLineCap: LineCapStyle.Round,
    opacity: obj.opacity
  })
}

/**
 * Builds `freshDoc`'s page list from `pages` (in array order — that order IS
 * the final export order), applying deletion/reorder/insert/import/rotate,
 * and returns a lookup from each surviving PageMeta's stable `index` to the
 * PDFPage it ended up as in `freshDoc`. Deleted pages are simply omitted, so
 * they (and anything keyed to them in objectsByPage) disappear from the
 * output — the omission from this map is what actually enforces that.
 */
async function buildPageMapping(
  freshDoc: PDFDocument,
  pages: PageMeta[],
  originalDoc: PDFDocument,
  importedDocsById: Map<string, PDFDocument>
): Promise<Map<number, PDFPage>> {
  const pageIndexToFreshPage = new Map<number, PDFPage>()

  for (const meta of pages) {
    if (meta.deleted) continue

    let page: PDFPage
    if (meta.source.kind === 'blank') {
      page = freshDoc.addPage([meta.widthPt, meta.heightPt])
    } else {
      const sourceDoc = meta.source.kind === 'original' ? originalDoc : importedDocsById.get(meta.source.importId)
      if (!sourceDoc) continue // an imported source that somehow isn't in the cache — skip rather than throw
      const [copied] = await freshDoc.copyPages(sourceDoc, [meta.source.sourcePageNumber - 1])
      page = freshDoc.addPage(copied)
    }

    if (meta.rotation !== 0) {
      // Additive on top of whatever /Rotate the copied page already carries
      // (pdf-lib's setRotation is absolute, so read-then-add is what makes
      // this correct without separately tracking the source's own rotation).
      page.setRotation(degrees(normalizeRotation(page.getRotation().angle + meta.rotation)))
    }

    pageIndexToFreshPage.set(meta.index, page)
  }

  return pageIndexToFreshPage
}

/**
 * Loads `originalBytes` (and any imported source PDFs), reconstructs the
 * page list described by `pages` (delete/reorder/insert-blank/import/rotate)
 * into a fresh document, draws every object in `objectsByPage` onto its
 * final page (sorted by z, bottom-to-front), and returns the resulting PDF
 * bytes. Pure/renderer-safe — never touches fs/path/electron; the caller
 * (main process, via IPC) is responsible for actually writing the result to
 * disk.
 */
export async function exportPdf(
  originalBytes: Uint8Array,
  objectsByPage: Record<number, PdfObject[]>,
  pages: PageMeta[],
  importedSources: Record<string, Uint8Array>
): Promise<Uint8Array> {
  let originalDoc: PDFDocument
  try {
    originalDoc = await PDFDocument.load(originalBytes, { updateMetadata: false })
  } catch (err) {
    throw toExportError(err)
  }

  const importedDocsById = new Map<string, PDFDocument>(
    await Promise.all(
      Object.entries(importedSources).map(
        async ([id, bytes]) => [id, await PDFDocument.load(bytes, { updateMetadata: false })] as const
      )
    )
  )

  const freshDoc = await PDFDocument.create()
  const registry = createFontRegistry(freshDoc)
  const imageRegistry = createImageRegistry(freshDoc)
  const pageIndexToFreshPage = await buildPageMapping(freshDoc, pages, originalDoc, importedDocsById)

  for (const [pageIndexKey, objects] of Object.entries(objectsByPage)) {
    const page = pageIndexToFreshPage.get(Number(pageIndexKey))
    if (!page || objects.length === 0) continue

    const cropBox = page.getCropBox()
    const pageRotation = normalizeRotation(page.getRotation().angle)

    const sorted = [...objects].sort((a, b) => a.z - b.z)
    for (const obj of sorted) {
      switch (obj.type) {
        case 'text': {
          const font = registry.embedStandard(resolveStandardFont(obj.fontFamily, obj.bold, obj.italic))
          drawTextObject(page, obj, font, cropBox, pageRotation)
          break
        }
        case 'image':
          await drawImageObject(page, obj, imageRegistry, cropBox, pageRotation)
          break
        case 'rect':
        case 'ellipse':
        case 'highlight':
        case 'whiteout':
          drawShapeObject(page, obj, cropBox, pageRotation)
          break
        case 'freehand':
        case 'line':
        case 'arrow':
        case 'signature':
          drawPathObject(page, obj, cropBox, pageRotation)
          break
      }
    }
  }

  return freshDoc.save()
}
