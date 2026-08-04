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

/** Where a page's content actually comes from. */
export type PageSource =
  | { kind: 'original'; sourcePageNumber: number } // 1-indexed, into the open doc's own originalBytes/pdfDoc
  | { kind: 'blank' }
  | { kind: 'imported'; importId: string; sourcePageNumber: number } // importId keys into documentStore's importedDocs cache

/** All geometry in PDF POINTS, origin TOP-LEFT of the page CropBox. */
export interface PageMeta {
  /** Stable id — NOT the array position. Assigned once per page (a monotonic
   *  counter continuing past the original page count for blank/imported
   *  pages) and never reused, even across reorder/delete/undo. */
  index: number
  source: PageSource
  widthPt: number // current effective size, already reflecting rotation's swap
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

export type FormFieldType = 'text' | 'checkbox' | 'dropdown' | 'optionList' | 'radioGroup' | 'button'

interface BaseFormField {
  name: string // PDFField.getName() — the stable key used to look the field back up on export
  type: FormFieldType
  readOnly: boolean
  required: boolean
}

export interface TextFormField extends BaseFormField {
  type: 'text'
  value: string
  multiline: boolean
  maxLength: number | null
}

export interface CheckBoxFormField extends BaseFormField {
  type: 'checkbox'
  checked: boolean
}

export interface DropdownFormField extends BaseFormField {
  type: 'dropdown'
  options: string[]
  selected: string[] // pdf-lib's getSelected() is always string[], even for single-select
  multiselect: boolean
}

export interface OptionListFormField extends BaseFormField {
  type: 'optionList'
  options: string[]
  selected: string[]
  multiselect: boolean
}

export interface RadioGroupFormField extends BaseFormField {
  type: 'radioGroup'
  options: string[]
  selected: string | null
}

/** A push button has no fillable value — rendered as a read-only row. */
export interface ButtonFormField extends BaseFormField {
  type: 'button'
}

export type FormField =
  | TextFormField
  | CheckBoxFormField
  | DropdownFormField
  | OptionListFormField
  | RadioGroupFormField
  | ButtonFormField

interface BaseWatermarkConfig {
  enabled: boolean
  /** 0..1, fraction of the page's own effective (viewport) width/height —
   *  anchors the TOP-LEFT corner of the watermark's box, same convention as
   *  BaseObject.x/y. One shared fraction renders sensibly across a range of
   *  possibly different-sized pages, unlike an absolute point position. */
  xFraction: number
  yFraction: number
  rotationDeg: number // clockwise, same convention as BaseObject.rotation
  opacity: number // 0..1
  /** Resolved SET of stable PageMeta.index values this watermark applies to
   *  — the only source of truth for "which pages". Computed once by
   *  applyRange, never re-resolved off current visual position. */
  pageIndices: number[]
  /** Last-typed 1-indexed visual page range — display prefill ONLY when
   *  reopening the panel; never consulted by the overlay or exportPdf. */
  rangeInput: { from: number; to: number } | null
}

export interface TextWatermarkConfig extends BaseWatermarkConfig {
  type: 'text'
  text: string
  fontFamily: string // key into renderer/core/fontFamilies.ts, same as TextObject.fontFamily
  fontSize: number
  color: string // #rrggbb
}

export interface ImageWatermarkConfig extends BaseWatermarkConfig {
  type: 'image'
  dataUrl: string | null // null until the user has picked a file
  mime: 'image/png' | 'image/jpeg' | null
  naturalWidth: number // px, natural size from the picked file
  naturalHeight: number
  scale: number // multiplier on naturalWidth/naturalHeight
}

export type WatermarkConfig = TextWatermarkConfig | ImageWatermarkConfig
