import type { ImageObject, PathObject, PdfObject, ShapeObject, TextObject } from '../../shared/types'

export const DEFAULT_TEXT_WIDTH_PT = 160
export const DEFAULT_TEXT_HEIGHT_PT = 24
export const DEFAULT_FONT_FAMILY = 'sans'
export const DEFAULT_FONT_SIZE_PT = 14
export const DEFAULT_TEXT_COLOR = '#000000'

export const DEFAULT_SHAPE_FILL = '#3b82f6'
export const DEFAULT_SHAPE_STROKE = '#1d4ed8'
export const DEFAULT_STROKE_WIDTH_PT = 2
export const DEFAULT_HIGHLIGHT_FILL = '#fde047'
export const DEFAULT_HIGHLIGHT_OPACITY = 0.4
export const DEFAULT_PATH_STROKE = '#111827'

/** crypto.randomUUID() is the Web Crypto API global (available in the
 *  Chromium renderer), not Node's `crypto` module — not an fs/path/electron import. */
const defaultIdFactory = (): string => crypto.randomUUID()

type TextObjectOverrides = Partial<
  Omit<TextObject, 'id' | 'pageIndex' | 'type' | 'x' | 'y' | 'z'>
>

/**
 * Builds a fully-formed TextObject with sensible defaults. `z` is injected by
 * the caller (via core/zOrder.ts's nextZ()) rather than computed internally,
 * so this stays a pure function of its inputs.
 */
export function createTextObject(
  pageIndex: number,
  xPt: number,
  yPt: number,
  z: number,
  overrides: TextObjectOverrides = {},
  // crypto.randomUUID() is the Web Crypto API global (available in the
  // Chromium renderer), not Node's `crypto` module — not an fs/path/electron import.
  idFactory: () => string = () => crypto.randomUUID()
): TextObject {
  return {
    id: idFactory(),
    pageIndex,
    type: 'text',
    x: xPt,
    y: yPt,
    width: DEFAULT_TEXT_WIDTH_PT,
    height: DEFAULT_TEXT_HEIGHT_PT,
    rotation: 0,
    opacity: 1,
    z,
    locked: false,
    text: '',
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: DEFAULT_FONT_SIZE_PT,
    color: DEFAULT_TEXT_COLOR,
    bold: false,
    italic: false,
    align: 'left',
    lineHeight: 1.2,
    ...overrides
  }
}

type ShapeObjectOverrides = Partial<
  Omit<ShapeObject, 'id' | 'pageIndex' | 'type' | 'x' | 'y' | 'width' | 'height' | 'z'>
>

const SHAPE_DEFAULTS: Record<
  ShapeObject['type'],
  Pick<ShapeObject, 'fill' | 'stroke' | 'strokeWidth' | 'opacity'>
> = {
  rect: { fill: null, stroke: DEFAULT_SHAPE_STROKE, strokeWidth: DEFAULT_STROKE_WIDTH_PT, opacity: 1 },
  ellipse: { fill: null, stroke: DEFAULT_SHAPE_STROKE, strokeWidth: DEFAULT_STROKE_WIDTH_PT, opacity: 1 },
  highlight: { fill: DEFAULT_HIGHLIGHT_FILL, stroke: null, strokeWidth: 0, opacity: DEFAULT_HIGHLIGHT_OPACITY },
  whiteout: { fill: '#ffffff', stroke: null, strokeWidth: 0, opacity: 1 }
}

/** Builds a rect/ellipse/highlight/whiteout ShapeObject. Unlike text, these
 *  are always sized by a drag gesture at creation time, so width/height are
 *  required inputs rather than fixed defaults. */
export function createShapeObject(
  type: ShapeObject['type'],
  pageIndex: number,
  xPt: number,
  yPt: number,
  widthPt: number,
  heightPt: number,
  z: number,
  overrides: ShapeObjectOverrides = {},
  idFactory: () => string = defaultIdFactory
): ShapeObject {
  const defaults = SHAPE_DEFAULTS[type]
  return {
    id: idFactory(),
    pageIndex,
    type,
    x: xPt,
    y: yPt,
    width: widthPt,
    height: heightPt,
    rotation: 0,
    opacity: defaults.opacity,
    z,
    locked: false,
    fill: defaults.fill,
    stroke: defaults.stroke,
    strokeWidth: defaults.strokeWidth,
    ...overrides
  }
}

type PathObjectOverrides = Partial<
  Omit<PathObject, 'id' | 'pageIndex' | 'type' | 'x' | 'y' | 'width' | 'height' | 'points' | 'z'>
>

/** Builds a freehand/line/arrow/signature PathObject. `points` (one flat
 *  stroke array per pen-lift, relative to x,y) is supplied by the caller —
 *  captured from the drag/draw gesture, not defaulted. */
export function createPathObject(
  type: PathObject['type'],
  pageIndex: number,
  xPt: number,
  yPt: number,
  widthPt: number,
  heightPt: number,
  points: number[][],
  z: number,
  overrides: PathObjectOverrides = {},
  idFactory: () => string = defaultIdFactory
): PathObject {
  return {
    id: idFactory(),
    pageIndex,
    type,
    x: xPt,
    y: yPt,
    width: widthPt,
    height: heightPt,
    rotation: 0,
    opacity: 1,
    z,
    locked: false,
    points,
    stroke: DEFAULT_PATH_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH_PT,
    ...overrides
  }
}

type ImageObjectOverrides = Partial<
  Omit<ImageObject, 'id' | 'pageIndex' | 'type' | 'x' | 'y' | 'width' | 'height' | 'dataUrl' | 'mime' | 'z'>
>

/** Builds an ImageObject. `dataUrl`/`mime` and the placed width/height come
 *  from the caller (file picker / paste / drag-drop already resolved the
 *  image bytes and its natural aspect ratio before this is called). */
export function createImageObject(
  pageIndex: number,
  xPt: number,
  yPt: number,
  widthPt: number,
  heightPt: number,
  dataUrl: string,
  mime: ImageObject['mime'],
  z: number,
  overrides: ImageObjectOverrides = {},
  idFactory: () => string = defaultIdFactory
): ImageObject {
  return {
    id: idFactory(),
    pageIndex,
    type: 'image',
    x: xPt,
    y: yPt,
    width: widthPt,
    height: heightPt,
    rotation: 0,
    opacity: 1,
    z,
    locked: false,
    dataUrl,
    mime,
    ...overrides
  }
}

/** Linear scan across all pages' buckets — total object count is small
 *  enough (tens–low hundreds) that this doesn't need a secondary index. */
export function findObjectById(
  objectsByPage: Record<number, PdfObject[]>,
  id: string
): PdfObject | undefined {
  for (const objects of Object.values(objectsByPage)) {
    const found = objects.find((o) => o.id === id)
    if (found) return found
  }
  return undefined
}
