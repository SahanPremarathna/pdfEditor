import fontkit from '@pdf-lib/fontkit'
import { type PDFDocument, type PDFFont, StandardFonts } from 'pdf-lib'

/**
 * Font bytes for one family key. fonts.ts never touches fs/path/electron —
 * callers (a future main-process loader reading resources/fonts/*.ttf over
 * IPC) hand bytes across; that loader is not built in this phase.
 */
export interface FontSource {
  family: string
  bytes: Uint8Array
}

export interface FontRegistry {
  /** Records raw bytes under a family key. Embedding is deferred until embed()
   *  is first called for that family, so unregistered/unused families never
   *  get embedded (keeps export size down). */
  registerSource(source: FontSource): void
  /** Embeds (fontkit, always subset) and caches the PDFFont for `family`,
   *  scoped to this registry's PDFDocument. Returns the same cached instance
   *  on repeat calls. Throws if no source was registered for `family` — no
   *  silent fallback font. */
  embed(family: string): Promise<PDFFont>
  /** Escape hatch onto pdf-lib's 14 standard (WinAnsi-only) fonts, cached the
   *  same way. */
  embedStandard(font: StandardFonts): PDFFont
}

/**
 * Creates a registry bound to one PDFDocument and registers fontkit on it.
 *
 * Caching is per-registry-instance, never module-level/global: a PDFFont
 * returned by embed()/embedStandard() is only valid for the exact
 * PDFDocument it was embedded into. A shared cache across documents would
 * silently produce corrupt PDFs referencing the wrong document's font
 * resource.
 */
export function createFontRegistry(doc: PDFDocument): FontRegistry {
  doc.registerFontkit(fontkit)

  const sources = new Map<string, Uint8Array>()
  const embedded = new Map<string, PDFFont>()
  const standardEmbedded = new Map<StandardFonts, PDFFont>()

  return {
    registerSource(source: FontSource): void {
      sources.set(source.family, source.bytes)
    },

    async embed(family: string): Promise<PDFFont> {
      const cached = embedded.get(family)
      if (cached) return cached

      const bytes = sources.get(family)
      if (!bytes) {
        throw new Error(`No font source registered for family "${family}"`)
      }

      const font = await doc.embedFont(bytes, { subset: true })
      embedded.set(family, font)
      return font
    },

    embedStandard(font: StandardFonts): PDFFont {
      const cached = standardEmbedded.get(font)
      if (cached) return cached

      const embeddedFont = doc.embedStandardFont(font)
      standardEmbedded.set(font, embeddedFont)
      return embeddedFont
    }
  }
}
