/// <reference types="vite/client" />

import type { PlatformApi } from './platform/types'

declare global {
  interface Window {
    /** Present only under the Electron preload — go through platform() instead of reading this directly. */
    api?: PlatformApi
  }
}

export {}
