import { idbDelete, idbGet, idbGetAll, idbPut } from './idb'
import { makeDocKey, MAX_RECENT_BYTES, nameFromKey, sanitizePdfName, selectEvictions } from './recentPolicy'
import type { OpenDialogResult } from '../../shared/types'
import type { PlatformApi, RecentEntry } from './types'

/*
 * Browser host for TrueFreePDF. Files come in through the File System Access API
 * where the browser has it (Chromium: Save writes straight back to the file
 * the user opened) and through a plain <input type=file> + download
 * everywhere else (Firefox, Safari: Save downloads the edited PDF).
 */

// The File System Access API's pickers and permission calls aren't in
// TypeScript's DOM lib yet — declared here with only the members used.
interface PickerType {
  description: string
  accept: Record<string, string[]>
}
type PermissionMode = { mode: 'read' | 'readwrite' }
interface HandleWithPermissions extends FileSystemFileHandle {
  queryPermission?: (desc: PermissionMode) => Promise<PermissionState>
  requestPermission?: (desc: PermissionMode) => Promise<PermissionState>
}
interface FsAccessWindow {
  showOpenFilePicker?: (opts: { types: PickerType[]; multiple?: boolean }) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (opts: { suggestedName: string; types: PickerType[] }) => Promise<FileSystemFileHandle>
}

const PDF_PICKER_TYPES: PickerType[] = [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }]

interface StoredRecent {
  key: string
  name: string
  size: number
  openedAt: number
  handle?: FileSystemFileHandle
  bytes?: Uint8Array
}

/** Documents opened in THIS tab — the handle (if any) Save writes back to. */
const session = new Map<string, { handle?: FileSystemFileHandle }>()

const fsWindow = (): FsAccessWindow => window as unknown as FsAccessWindow

const isAbortError = (err: unknown): boolean => err instanceof DOMException && err.name === 'AbortError'

async function ensurePermission(handle: FileSystemFileHandle, mode: PermissionMode['mode']): Promise<boolean> {
  const h = handle as HandleWithPermissions
  if (!h.queryPermission || !h.requestPermission) return true
  if ((await h.queryPermission({ mode })) === 'granted') return true
  return (await h.requestPermission({ mode })) === 'granted'
}

/** Records (or refreshes) a recent-files entry. Storage failures are never
 *  fatal — recents are a convenience, opening/saving must still succeed. */
async function rememberRecent(key: string, name: string, bytes: Uint8Array, handle?: FileSystemFileHandle): Promise<void> {
  try {
    const all = await idbGetAll<StoredRecent>()
    // One entry per file: drop an older entry for the same handle/name first.
    for (const existing of all) {
      const sameHandle = handle && existing.handle && (await existing.handle.isSameEntry(handle))
      if (existing.key !== key && (sameHandle || (!handle && !existing.handle && existing.name === name))) {
        await idbDelete(existing.key)
      }
    }
    const storeBytes = !handle && bytes.byteLength <= MAX_RECENT_BYTES
    const entry: StoredRecent = {
      key,
      name,
      size: bytes.byteLength,
      openedAt: Date.now(),
      handle,
      bytes: storeBytes ? bytes.slice() : undefined
    }
    await idbPut(entry)

    const remaining = await idbGetAll<StoredRecent>()
    const evictions = selectEvictions(
      remaining.map((r) => ({ key: r.key, openedAt: r.openedAt, storedBytes: r.bytes?.byteLength ?? 0 }))
    )
    await Promise.all(evictions.map((k) => idbDelete(k)))
  } catch {
    // Private browsing / storage disabled — recents simply stay empty.
  }
}

function newKey(name: string): string {
  return makeDocKey(name, crypto.randomUUID())
}

async function registerOpened(name: string, bytes: Uint8Array, handle?: FileSystemFileHandle): Promise<OpenDialogResult> {
  const key = newKey(name)
  session.set(key, { handle })
  await rememberRecent(key, sanitizePdfName(name), bytes, handle)
  return { path: key, bytes }
}

/** Hidden <input type=file> fallback. Resolves null on cancel — the `cancel`
 *  event is fired by every current evergreen browser. */
function pickWithInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,.pdf'
    input.style.display = 'none'
    const cleanup = (): void => input.remove()
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null)
      cleanup()
    })
    input.addEventListener('cancel', () => {
      resolve(null)
      cleanup()
    })
    document.body.appendChild(input)
    input.click()
  })
}

function download(fileName: string, bytes: Uint8Array): void {
  // Copy into a plain ArrayBuffer-backed view — Blob rejects SharedArrayBuffer views under strict typing.
  const blob = new Blob([bytes.slice()], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sanitizePdfName(fileName)
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke later — revoking synchronously can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

async function writeToHandle(handle: FileSystemFileHandle, bytes: Uint8Array): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(bytes.slice())
  await writable.close()
}

let isDirty = false
let beforeUnloadInstalled = false

function installBeforeUnload(): void {
  if (beforeUnloadInstalled) return
  beforeUnloadInstalled = true
  window.addEventListener('beforeunload', (e) => {
    if (!isDirty) return
    e.preventDefault()
    // Legacy browsers only show the prompt when returnValue is set.
    e.returnValue = ''
  })
}

export const webPlatform: PlatformApi = {
  async openDialog() {
    const picker = fsWindow().showOpenFilePicker
    if (picker) {
      let handles: FileSystemFileHandle[]
      try {
        handles = await picker({ types: PDF_PICKER_TYPES, multiple: false })
      } catch (err) {
        if (isAbortError(err)) return null
        throw err
      }
      const handle = handles[0]
      if (!handle) return null
      const file = await handle.getFile()
      return registerOpened(file.name, new Uint8Array(await file.arrayBuffer()), handle)
    }

    const file = await pickWithInput()
    if (!file) return null
    return registerOpened(file.name, new Uint8Array(await file.arrayBuffer()))
  },

  async registerFile(file) {
    return registerOpened(file.name, new Uint8Array(await file.arrayBuffer()))
  },

  async readFile(key) {
    const stored = await idbGet<StoredRecent>(key).catch(() => undefined)
    if (!stored) throw new Error('That file is no longer available. Open it again from your device.')

    if (stored.handle) {
      if (!(await ensurePermission(stored.handle, 'read'))) {
        throw new Error('Permission to read that file was denied.')
      }
      const file = await stored.handle.getFile()
      const bytes = new Uint8Array(await file.arrayBuffer())
      session.set(key, { handle: stored.handle })
      await rememberRecent(key, file.name, bytes, stored.handle)
      return bytes
    }
    if (!stored.bytes) throw new Error('That file was too large to keep offline. Open it again from your device.')
    session.set(key, {})
    await rememberRecent(key, stored.name, stored.bytes)
    return stored.bytes.slice()
  },

  async save(key, bytes) {
    const handle = session.get(key)?.handle
    const name = nameFromKey(key)
    if (handle && (await ensurePermission(handle, 'readwrite'))) {
      await writeToHandle(handle, bytes)
      await rememberRecent(key, name, bytes, handle)
      return
    }
    download(name, bytes)
    await rememberRecent(key, name, bytes)
  },

  async saveAs(defaultName, bytes) {
    const picker = fsWindow().showSaveFilePicker
    if (picker) {
      let handle: FileSystemFileHandle
      try {
        handle = await picker({ suggestedName: sanitizePdfName(defaultName), types: PDF_PICKER_TYPES })
      } catch (err) {
        if (isAbortError(err)) return null
        throw err
      }
      await writeToHandle(handle, bytes)
      const key = newKey(handle.name)
      session.set(key, { handle })
      await rememberRecent(key, handle.name, bytes, handle)
      return key
    }

    const name = sanitizePdfName(defaultName)
    download(name, bytes)
    const key = newKey(name)
    session.set(key, {})
    await rememberRecent(key, name, bytes)
    return key
  },

  download,

  notifyDirty(dirty) {
    installBeforeUnload()
    isDirty = dirty
  },

  // No native close dialog in a browser — beforeunload covers unsaved work.
  onRequestSaveBeforeClose: () => () => undefined,
  notifySaveBeforeCloseResult: () => undefined,
  onMenuAction: () => () => undefined,
  getLaunchPath: async () => null,

  async getRecent() {
    return (await this.getRecentEntries?.())?.map((e) => e.key) ?? []
  },

  async getRecentEntries(): Promise<RecentEntry[]> {
    try {
      const all = await idbGetAll<StoredRecent>()
      return all
        .sort((a, b) => b.openedAt - a.openedAt)
        .map((r) => ({ key: r.key, name: r.name, size: r.size, openedAt: r.openedAt }))
    } catch {
      return []
    }
  },

  async removeRecent(key) {
    await idbDelete(key).catch(() => undefined)
  }
}
