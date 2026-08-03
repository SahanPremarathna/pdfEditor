import { rgb, type RGB } from 'pdf-lib'

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/

/** Parses a `#rrggbb` string (TextObject.color's format) into a pdf-lib RGB
 *  color for drawText's `color` option. Throws on malformed input rather
 *  than silently defaulting — a bad color string should surface as an
 *  export error, not silently draw black text. */
export function hexToRgbColor(hex: string): RGB {
  const match = HEX_COLOR_PATTERN.exec(hex)
  if (!match) {
    throw new Error(`Invalid color "${hex}": expected a #rrggbb hex string`)
  }

  const [r, g, b] = [match[1].slice(0, 2), match[1].slice(2, 4), match[1].slice(4, 6)].map(
    (component) => parseInt(component, 16) / 255
  )

  return rgb(r, g, b)
}
