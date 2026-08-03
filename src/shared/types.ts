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
