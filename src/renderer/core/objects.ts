import type { TextObject } from '../../shared/types'

export const DEFAULT_TEXT_WIDTH_PT = 160
export const DEFAULT_TEXT_HEIGHT_PT = 24
export const DEFAULT_FONT_FAMILY = 'sans'
export const DEFAULT_FONT_SIZE_PT = 14
export const DEFAULT_TEXT_COLOR = '#000000'

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

/** Linear scan across all pages' buckets — total object count is small
 *  enough (tens–low hundreds) that this doesn't need a secondary index. */
export function findObjectById(
  objectsByPage: Record<number, TextObject[]>,
  id: string
): TextObject | undefined {
  for (const objects of Object.values(objectsByPage)) {
    const found = objects.find((o) => o.id === id)
    if (found) return found
  }
  return undefined
}
