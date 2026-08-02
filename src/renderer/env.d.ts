/// <reference types="vite/client" />

import type { OpenDialogResult } from '../shared/types'

declare global {
  interface Window {
    api: {
      openDialog: () => Promise<OpenDialogResult | null>
      readFile: (path: string) => Promise<Uint8Array>
    }
  }
}

export {}
