/** Pure bookkeeping for the browser recent-files list, kept separate from
 *  the IndexedDB/DOM plumbing in web.ts so it can be unit tested. */

export const MAX_RECENT_ENTRIES = 8
/** Only files opened without a persistent handle store their bytes; this caps
 *  how much of the origin's storage quota those copies may use. */
export const MAX_RECENT_BYTES = 60 * 1024 * 1024

export interface RecentSizeInfo {
  key: string
  openedAt: number
  storedBytes: number
}

/** Keys to evict so that at most `maxCount` entries and `maxBytes` of stored
 *  bytes remain — oldest first. The newest entry is never evicted, even if it
 *  alone exceeds the byte cap (the caller decides whether to store it at all). */
export function selectEvictions(
  entries: RecentSizeInfo[],
  maxCount: number = MAX_RECENT_ENTRIES,
  maxBytes: number = MAX_RECENT_BYTES
): string[] {
  const newestFirst = [...entries].sort((a, b) => b.openedAt - a.openedAt)
  const evict: string[] = []
  let total = 0
  newestFirst.forEach((entry, i) => {
    const keep = i === 0 || (i < maxCount && total + entry.storedBytes <= maxBytes)
    if (keep) total += entry.storedBytes
    else evict.push(entry.key)
  })
  return evict
}

/** Strips characters no filesystem accepts and guarantees a .pdf extension. */
export function sanitizePdfName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'document.pdf'
  return /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned}.pdf`
}

/** Opaque document key whose final `/` segment is the display name — stores
 *  derive fileName with `key.split(/[/\\]/).pop()`, same as a desktop path. */
export function makeDocKey(name: string, id: string): string {
  return `web:${id}/${sanitizePdfName(name)}`
}

export function nameFromKey(key: string): string {
  return key.split(/[/\\]/).pop() ?? key
}
