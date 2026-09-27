import { loadBundledFont, type FontLoader } from '../core/fontAssets'
import { fileUrlToPath } from './fileUrl'
import { nameFromKey } from './recentPolicy'
import { webPlatform } from './web'
import type { PlatformApi, RecentEntry } from './types'

export type { PlatformApi, RecentEntry } from './types'

/**
 * The host this renderer runs under: the Electron preload's `window.api` when
 * present, the browser implementation otherwise. Resolved on every call (not
 * cached at import time) so tests can `vi.stubGlobal('window', { api })`.
 */
export function platform(): PlatformApi {
  return (typeof window !== 'undefined' && window.api) || webPlatform
}

export const isWebHost = (): boolean => platform() === webPlatform

/** Recent files with display metadata — desktop hosts only return paths, so
 *  those are mapped to name-only entries. */
export async function getRecentEntries(): Promise<RecentEntry[]> {
  const api = platform()
  if (api.getRecentEntries) return api.getRecentEntries()
  const paths = await api.getRecent()
  return paths.map((key) => ({ key, name: nameFromKey(key), size: null, openedAt: null }))
}

/**
 * Loads a bundled export font. The packaged desktop app serves its renderer
 * from file://, where Chromium's fetch() refuses to work — there the TTF is
 * read through the host's readFile instead. Everywhere else it's a normal
 * same-origin fetch (service-worker cached).
 */
export const loadAppFont: FontLoader = (file) => {
  const api = typeof window !== 'undefined' ? window.api : undefined
  if (api && window.location.protocol === 'file:') {
    return api.readFile(fileUrlToPath(new URL(`fonts/${file}`, window.location.href)))
  }
  return loadBundledFont(file)
}

/** Hands the user a copy of `bytes` without changing the open document's
 *  save target — used for page extraction. Desktop hosts get a Save-As dialog. */
export async function downloadCopy(fileName: string, bytes: Uint8Array): Promise<void> {
  const api = platform()
  if (api.download) {
    api.download(fileName, bytes)
    return
  }
  await api.saveAs(fileName, bytes)
}
