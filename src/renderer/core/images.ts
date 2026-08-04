import type { PDFDocument, PDFImage } from 'pdf-lib'
import { dataUrlToBytes } from './dataUrl'

export interface ImageRegistry {
  /** Embeds (or returns the cached embed of) the image at `dataUrl`. Keyed
   *  by dataUrl so the same signature/image reused across objects/pages is
   *  only embedded into the PDF once. */
  embed(dataUrl: string, mime: 'image/png' | 'image/jpeg'): Promise<PDFImage>
}

/** Caching is per-registry-instance, never module-level/global — mirrors
 *  core/fonts.ts's createFontRegistry: a PDFImage is only valid for the
 *  exact PDFDocument it was embedded into. */
export function createImageRegistry(doc: PDFDocument): ImageRegistry {
  const embedded = new Map<string, Promise<PDFImage>>()

  return {
    embed(dataUrl, mime) {
      const cached = embedded.get(dataUrl)
      if (cached) return cached

      const promise =
        mime === 'image/jpeg' ? doc.embedJpg(dataUrlToBytes(dataUrl)) : doc.embedPng(dataUrlToBytes(dataUrl))
      embedded.set(dataUrl, promise)
      return promise
    }
  }
}
