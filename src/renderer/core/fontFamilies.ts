/**
 * On-screen font family keys for Phase 3. These are opaque keys stored on
 * TextObject.fontFamily and mapped here to a CSS font stack purely for
 * Konva/DOM rendering — they are NOT yet reconciled with fonts.ts's real
 * pdf-lib/fontkit embedding registry (no TTFs are bundled under
 * resources/fonts/ yet). That reconciliation happens at Phase 4 export time.
 */
export const ON_SCREEN_FONT_FAMILIES = ['sans', 'serif', 'mono'] as const
export type OnScreenFontFamily = (typeof ON_SCREEN_FONT_FAMILIES)[number]

const FONT_FAMILY_CSS: Record<OnScreenFontFamily, string> = {
  sans: '"Inter", "Segoe UI", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Consolas", "Courier New", monospace'
}

function isOnScreenFontFamily(family: string): family is OnScreenFontFamily {
  return (ON_SCREEN_FONT_FAMILIES as readonly string[]).includes(family)
}

/** Maps a TextObject.fontFamily key to a CSS font-family stack for on-screen
 *  rendering (Konva Text's fontFamily prop and the inline-edit textarea).
 *  Unknown/legacy keys fall back to 'sans' rather than throwing — screen
 *  rendering should never hard-fail on a bad font key. */
export function fontFamilyToCss(family: string): string {
  return FONT_FAMILY_CSS[isOnScreenFontFamily(family) ? family : 'sans']
}
