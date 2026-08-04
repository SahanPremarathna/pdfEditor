/** A point in a top-left-origin, y-down coordinate space. Unit (px or pt) is
 *  determined by context — see renderer/core/coords.ts for the pt-space conventions. */
export interface Point {
  x: number
  y: number
}

/** An axis-aligned rect in a top-left-origin, y-down coordinate space. */
export interface Rect extends Point {
  width: number
  height: number
}

/** All geometry in PDF POINTS, origin TOP-LEFT of the page CropBox. */
export interface PageMeta {
  index: number
  widthPt: number // CropBox width AFTER applying /Rotate
  heightPt: number
  rotation: 0 | 90 | 180 | 270 // user-applied delta, not the original
  deleted: boolean
}

export interface OpenDialogResult {
  path: string
  bytes: Uint8Array
}

export type ObjectType =
  | 'text'
  | 'image'
  | 'freehand'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'highlight'
  | 'whiteout'
  | 'signature'

/** All geometry in PDF POINTS, origin TOP-LEFT of the page CropBox. */
export interface BaseObject {
  id: string
  pageIndex: number
  type: ObjectType
  x: number
  y: number
  width: number
  height: number
  rotation: number // degrees clockwise
  opacity: number // 0..1
  z: number
  locked: boolean
}

export interface TextObject extends BaseObject {
  type: 'text'
  text: string
  fontFamily: string // key into renderer/core/fontFamilies.ts's on-screen CSS map
  fontSize: number
  color: string // #rrggbb
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  lineHeight: number
}

export interface ImageObject extends BaseObject {
  type: 'image'
  dataUrl: string // in-memory only, never persisted outside the exported PDF
  mime: 'image/png' | 'image/jpeg'
}

/**
 * Freehand strokes, straight lines/arrows, and signatures all share this
 * shape. `points` is one flat [x,y,x,y,...] array PER STROKE (points relative
 * to x,y, in POINTS, top-left/y-down — same convention as everywhere else),
 * so freehand/signature can capture multiple pen-lifts. `line`/`arrow` are
 * just a single stroke with exactly one point pair per array.
 */
export interface PathObject extends BaseObject {
  type: 'freehand' | 'line' | 'arrow' | 'signature'
  points: number[][]
  stroke: string // #rrggbb
  strokeWidth: number
}

export interface ShapeObject extends BaseObject {
  type: 'rect' | 'ellipse' | 'highlight' | 'whiteout'
  fill: string | null // #rrggbb, null = stroke-only
  stroke: string | null // #rrggbb, null = no border
  strokeWidth: number
}

export type PdfObject = TextObject | ImageObject | PathObject | ShapeObject
