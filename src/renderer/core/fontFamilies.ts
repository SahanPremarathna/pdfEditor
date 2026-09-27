/**
 * On-screen font family keys, stored on TextObject.fontFamily and mapped
 * here to a CSS font stack for Konva/DOM rendering.
 *
 * Each stack LEADS with fonts metric-compatible with the PDF standard font
 * export uses for that key (Arial/Liberation Sans ≈ Helvetica, Times New
 * Roman/Liberation Serif ≈ Times, Courier New/Liberation Mono ≈ Courier), so
 * on-screen line wrapping matches the saved PDF. The bundled Noto Sinhala/
 * Tamil faces (declared in styles.css) come next, so those scripts render on
 * screen with the same glyphs export embeds.
 */
export const ON_SCREEN_FONT_FAMILIES = ['sans', 'serif', 'mono'] as const
export type OnScreenFontFamily = (typeof ON_SCREEN_FONT_FAMILIES)[number]

const INDIC_FALLBACKS = '"TrueFreePDF Noto Sinhala", "TrueFreePDF Noto Tamil"'

const FONT_FAMILY_CSS: Record<OnScreenFontFamily, string> = {
  sans: `Arial, Helvetica, "Liberation Sans", Arimo, ${INDIC_FALLBACKS}, sans-serif`,
  serif: `"Times New Roman", Times, "Liberation Serif", Tinos, ${INDIC_FALLBACKS}, serif`,
  mono: `"Courier New", Courier, "Liberation Mono", Cousine, ${INDIC_FALLBACKS}, monospace`
}

/** Human-readable names for the family picker. */
export const FONT_FAMILY_LABELS: Record<OnScreenFontFamily, string> = {
  sans: 'Sans (Helvetica)',
  serif: 'Serif (Times)',
  mono: 'Mono (Courier)'
}

function isOnScreenFontFamily(family: string): family is OnScreenFontFamily {
  return (ON_SCREEN_FONT_FAMILIES as readonly string[]).includes(family)
}

/** Normalizes a TextObject.fontFamily key to a known OnScreenFontFamily,
 *  falling back to 'sans' for unknown/legacy keys — shared by the on-screen
 *  CSS mapping (fontFamilyToCss) and export's standard-font mapping
 *  (exportPdf.ts), so both sides agree on the same fallback rule instead of
 *  drifting. */
export function normalizeFontFamily(family: string): OnScreenFontFamily {
  return isOnScreenFontFamily(family) ? family : 'sans'
}

/** Maps a TextObject.fontFamily key to a CSS font-family stack for on-screen
 *  rendering (Konva Text's fontFamily prop and the inline-edit textarea).
 *  Unknown/legacy keys fall back to 'sans' rather than throwing — screen
 *  rendering should never hard-fail on a bad font key. */
export function fontFamilyToCss(family: string): string {
  return FONT_FAMILY_CSS[normalizeFontFamily(family)]
}
