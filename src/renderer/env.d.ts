/// <reference types="vite/client" />

import type { OpenDialogResult } from '../shared/types'

declare global {
  interface Window {
    api: {
      openDialog: () => Promise<OpenDialogResult | null>
      readFile: (path: string) => Promise<Uint8Array>
      save: (path: string, bytes: Uint8Array) => Promise<void>
      saveAs: (defaultName: string, bytes: Uint8Array) => Promise<string | null>
      notifyDirty: (isDirty: boolean) => void
      onRequestSaveBeforeClose: (cb: () => void) => () => void
      notifySaveBeforeCloseResult: (success: boolean) => void
      getRecent: () => Promise<string[]>
      onMenuAction: (cb: (action: string) => void) => () => void
    }
  }
}

export {}
