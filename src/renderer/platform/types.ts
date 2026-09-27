import type { OpenDialogResult } from '../../shared/types'

/** A file the user opened recently, as shown on the welcome screen. `key` is
 *  whatever the platform's readFile() accepts — an absolute path on desktop,
 *  an opaque `web:<id>/<name>` key in the browser. */
export interface RecentEntry {
  key: string
  name: string
  size: number | null
  openedAt: number | null
}

/**
 * Everything the renderer needs from its host. The Electron preload's
 * `window.api` already satisfies the required members; the browser build
 * provides the same contract in platform/web.ts, so stores never need to
 * know which host they're running under.
 *
 * "Paths" are opaque document keys: stores only ever hand back a key they
 * previously received from openDialog/saveAs/getRecent, and derive the
 * display name from its last `/` or `\` segment.
 */
export interface PlatformApi {
  openDialog: () => Promise<OpenDialogResult | null>
  readFile: (path: string) => Promise<Uint8Array>
  save: (path: string, bytes: Uint8Array) => Promise<void>
  saveAs: (defaultName: string, bytes: Uint8Array) => Promise<string | null>
  notifyDirty: (isDirty: boolean) => void
  onRequestSaveBeforeClose: (cb: () => void) => () => void
  notifySaveBeforeCloseResult: (success: boolean) => void
  getRecent: () => Promise<string[]>
  getLaunchPath: () => Promise<string | null>
  onMenuAction: (cb: (action: string) => void) => () => void
  /** Browser-only extras. Optional so the Electron preload (and test stubs)
   *  don't have to implement them — see platform/index.ts for fallbacks. */
  getRecentEntries?: () => Promise<RecentEntry[]>
  registerFile?: (file: File) => Promise<OpenDialogResult>
  download?: (fileName: string, bytes: Uint8Array) => void
  removeRecent?: (key: string) => Promise<void>
}
