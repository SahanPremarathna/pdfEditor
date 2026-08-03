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

/** Only TextObject exists as of Phase 3 — ImageObject/PathObject/ShapeObject join this union in Phase 5. */
export type PdfObject = TextObject
