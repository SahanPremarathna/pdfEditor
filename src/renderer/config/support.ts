/**
 * Donation / support settings, read from build-time env vars (see
 * .env.example). Inkline is free — these only power the optional
 * "Support on Ko-fi" links. Ko-fi is an outgoing link in a new tab; its
 * embeddable widget is deliberately not used (it loads from a CDN).
 */

function kofiUrl(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' && (url.hostname === 'ko-fi.com' || url.hostname === 'www.ko-fi.com') ? url.href : null
  } catch {
    return null
  }
}

function httpsUrl(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

/** Built-in default so every deployment asks for the right page; set
 *  VITE_KOFI_URL to override it (e.g. for a fork). */
const DEFAULT_KOFI_URL = 'https://ko-fi.com/sahantp'

export const KOFI_URL = kofiUrl(import.meta.env.VITE_KOFI_URL) ?? kofiUrl(DEFAULT_KOFI_URL)
export const MAKER_NAME = import.meta.env.VITE_MAKER_NAME?.trim() || null
export const REPO_URL = httpsUrl(import.meta.env.VITE_REPO_URL)

if (!KOFI_URL && import.meta.env.DEV) {
  console.warn('[Inkline] VITE_KOFI_URL is not set (or not a https://ko-fi.com link) — donate buttons fall back to "Share".')
}

/** The public address people share — the running site itself. */
export function shareUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}
