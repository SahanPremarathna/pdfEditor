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
