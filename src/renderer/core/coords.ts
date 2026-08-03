import type { Point, Rect } from '../../shared/types'

/**
 * The PDF page's OWN pre-existing /Rotate value (e.g. page.getRotation().angle
 * in pdf-lib, page.rotate in pdf.js) — NOT PageMeta.rotation, which is a
 * user-applied delta the app adds later on top of whatever this already is.
 * Do not conflate the two.
 */
export type PageRotation = 0 | 90 | 180 | 270

/**
 * Raw CropBox rect: bottom-left origin, y-up, UNROTATED points — exactly
 * what pdf-lib's page.getCropBox() returns. Never derive this from
 * getMediaBox()/getSize()/getWidth()/getHeight() (those read the MediaBox,
 * which can differ from the CropBox in print-prepped files).
 */
export type CropBox = Rect

/**
 * Normalizes a raw rotation angle (e.g. from page.getRotation().angle, which
 * pdf-lib types as a plain number) into a PageRotation. Throws on anything
 * not congruent to 0/90/180/270 mod 360, rather than silently truncating.
 */
export function normalizeRotation(angleDegrees: number): PageRotation {
  const normalized = ((angleDegrees % 360) + 360) % 360
  if (normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized
  }
  throw new Error(`Unsupported page rotation: ${angleDegrees} degrees (must be a multiple of 90)`)
}

export const pxToPt = (px: number, scale: number): number => px / scale
export const ptToPx = (pt: number, scale: number): number => pt * scale

/**
 * The on-screen (rotated) viewport size for a page — mirrors what pdf.js's
 * page.getViewport({ scale: 1 }).width/height reports. Width/height swap
 * for 90/270.
 */
export function viewportSize(
  cropBox: CropBox,
  rotation: PageRotation
): { width: number; height: number } {
  return rotation === 90 || rotation === 270
    ? { width: cropBox.height, height: cropBox.width }
    : { width: cropBox.width, height: cropBox.height }
}

/**
 * Maps a point FROM viewport/editor space (top-left origin, y-down, units =
 * points, dimensions = viewportSize()) INTO the page's raw (unrotated)
 * top-left-origin frame (dimensions = cropBox.width x cropBox.height).
 *
 * /Rotate does not change the coordinate space pdf-lib draws in — pdf-lib
 * always draws in the page's raw, unrotated content-stream space, and
 * /Rotate just rotates that whole raw canvas at display time. So mapping
 * from what the user sees (rotated viewport space) into what pdf-lib expects
 * (raw space) means inverting that display rotation, not a naive y-flip.
 */
export function viewportPointToRaw(point: Point, cropBox: CropBox, rotation: PageRotation): Point {
  const { width: w, height: h } = cropBox
  switch (rotation) {
    case 0:
      return { x: point.x, y: point.y }
    case 90:
      return { x: point.y, y: h - point.x }
    case 180:
      return { x: w - point.x, y: h - point.y }
    case 270:
      return { x: w - point.y, y: point.x }
  }
}

/** Exact inverse of viewportPointToRaw. */
export function rawPointToViewport(point: Point, cropBox: CropBox, rotation: PageRotation): Point {
  const { width: w, height: h } = cropBox
  switch (rotation) {
    case 0:
      return { x: point.x, y: point.y }
    case 90:
      return { x: h - point.y, y: point.x }
    case 180:
      return { x: w - point.x, y: h - point.y }
    case 270:
      return { x: point.y, y: w - point.x }
  }
}

/**
 * Editor-space rect (top-left origin, y-down, rotated viewport dimensions)
 * -> the bottom-left {x,y} point in raw PDF user space that pdf-lib's
 * drawRectangle/drawImage/etc. expect.
 *
 * Maps all 4 corners of `rect` through viewportPointToRaw and takes the
 * axis-aligned bounding box of the result (rotation moves which corner is
 * "top-left" and swaps width/height for 90/270, so the bounding box over all
 * 4 mapped corners is required, not just the mapped top-left corner), then
 * flips that raw top-left box into bottom-left PDF space using the CropBox's
 * own origin and height.
 */
export function toPdfSpace(rect: Rect, cropBox: CropBox, rotation: PageRotation): Point {
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height }
  ].map((corner) => viewportPointToRaw(corner, cropBox, rotation))

  const rawTopLeftX = Math.min(...corners.map((c) => c.x))
  const rawTopLeftY = Math.min(...corners.map((c) => c.y))
  const rawHeight = Math.max(...corners.map((c) => c.y)) - rawTopLeftY

  return {
    x: cropBox.x + rawTopLeftX,
    y: cropBox.y + cropBox.height - rawTopLeftY - rawHeight
  }
}

/**
 * Inverse of toPdfSpace — raw PDF-space bottom-left corner + known
 * editor-space size back to editor-space top-left.
 *
 * Mirrors toPdfSpace's corner-based approach rather than trying to invert a
 * single corner directly: rotation moves which corner of the raw bounding
 * box corresponds to the viewport rect's top-left (e.g. at 180° it's the
 * viewport rect's bottom-right corner that lands on the raw AABB's min-x/
 * min-y corner), so the raw AABB has to be reconstructed in full and mapped
 * back through all 4 corners, taking the min again on the viewport side.
 */
export function fromPdfSpace(
  pdfBottomLeft: Point,
  size: { width: number; height: number },
  cropBox: CropBox,
  rotation: PageRotation
): Point {
  const probeCorners = [
    { x: 0, y: 0 },
    { x: size.width, y: 0 },
    { x: 0, y: size.height },
    { x: size.width, y: size.height }
  ].map((corner) => viewportPointToRaw(corner, cropBox, rotation))
  const rawXExtent = Math.max(...probeCorners.map((c) => c.x)) - Math.min(...probeCorners.map((c) => c.x))
  const rawYExtent = Math.max(...probeCorners.map((c) => c.y)) - Math.min(...probeCorners.map((c) => c.y))

  const rawLocalX = pdfBottomLeft.x - cropBox.x
  const rawLocalY = cropBox.height - rawYExtent - (pdfBottomLeft.y - cropBox.y)

  const rawCorners = [
    { x: rawLocalX, y: rawLocalY },
    { x: rawLocalX + rawXExtent, y: rawLocalY },
    { x: rawLocalX, y: rawLocalY + rawYExtent },
    { x: rawLocalX + rawXExtent, y: rawLocalY + rawYExtent }
  ].map((corner) => rawPointToViewport(corner, cropBox, rotation))

  return {
    x: Math.min(...rawCorners.map((c) => c.x)),
    y: Math.min(...rawCorners.map((c) => c.y))
  }
}

/**
 * pdf-lib's drawText(text, {x,y}) places the BASELINE, not the box top.
 * Given a text box's top-left (editor space, points) and the font's
 * ascent-at-size (caller computes via font.heightAtSize(fontSize,
 * { descender: false }) — see fonts.ts), returns the raw-PDF-space {x,y} to
 * pass to drawText.
 *
 * Composition order matters: the top-left point is inverse-rotated into raw
 * space FIRST, then the ascent offset is applied along the raw y-axis.
 * pdf-lib draws glyphs growing "up" along the raw content stream's own
 * y-axis regardless of /Rotate (the flag rotates the whole raw canvas,
 * pre-existing content and new glyphs together, at display time) — applying
 * the ascent offset before un-rotating would offset along the wrong axis on
 * rotated pages, which would not show up as a bug on the unrotated case.
 */
export function textBaselineOrigin(
  topLeft: Point,
  ascentPt: number,
  cropBox: CropBox,
  rotation: PageRotation
): Point {
  const raw = viewportPointToRaw(topLeft, cropBox, rotation)
  return {
    x: cropBox.x + raw.x,
    y: cropBox.y + cropBox.height - raw.y - ascentPt
  }
}

/** Inverse of textBaselineOrigin. */
export function baselineOriginToTopLeft(
  baseline: Point,
  ascentPt: number,
  cropBox: CropBox,
  rotation: PageRotation
): Point {
  const rawX = baseline.x - cropBox.x
  const rawY = cropBox.height - (baseline.y - cropBox.y) - ascentPt
  return rawPointToViewport({ x: rawX, y: rawY }, cropBox, rotation)
}
