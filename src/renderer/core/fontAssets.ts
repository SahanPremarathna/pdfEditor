import { UNICODE_FALLBACK_FONT_FILES } from './unicodeText'

/**
 * Fetches a bundled TTF from public/fonts/ (same origin — works offline once
 * the service worker has cached it). Bytes are cached for the page's
 * lifetime; they're immutable, so sharing them across exports is safe
 * (unlike PDFFont objects, which fonts.ts scopes to one PDFDocument).
 */
const cache = new Map<string, Promise<Uint8Array>>()

export type FontLoader = (file: string) => Promise<Uint8Array>

export const loadBundledFont: FontLoader = (file) => {
  const cached = cache.get(file)
  if (cached) return cached

  const promise = fetch(`${import.meta.env.BASE_URL}fonts/${file}`).then(async (res) => {
    if (!res.ok) throw new Error(`Couldn't load the font needed for this text (${file}).`)
    return new Uint8Array(await res.arrayBuffer())
  })
  // A failed fetch (offline before the cache warmed) must be retryable.
  promise.catch(() => cache.delete(file))
  cache.set(file, promise)
  return promise
}

/** Fonts most exports need — fetched in the background after startup so
 *  they're in the offline cache before the user ever goes offline. */
export const PREFETCH_FONT_FILES = [
  'NotoSans-Regular.ttf',
  'NotoSans-Bold.ttf',
  'NotoSans-Italic.ttf',
  'NotoSans-BoldItalic.ttf',
  'NotoSerif-Regular.ttf',
  'NotoSerif-Bold.ttf',
  'NotoSerif-Italic.ttf',
  'NotoSerif-BoldItalic.ttf',
  'NotoSansMono-Regular.ttf',
  'NotoSansMono-Bold.ttf',
  'NotoSansSinhala-Regular.ttf',
  'NotoSansSinhala-Bold.ttf',
  'NotoSansTamil-Regular.ttf',
  'NotoSansTamil-Bold.ttf',
  ...UNICODE_FALLBACK_FONT_FILES
]

/** Warms the HTTP/service-worker cache only — the bytes aren't kept in
 *  memory until an export actually needs them. */
export function prefetchBundledFonts(): void {
  for (const file of PREFETCH_FONT_FILES) {
    void fetch(`${import.meta.env.BASE_URL}fonts/${file}`).catch(() => undefined)
  }
}
