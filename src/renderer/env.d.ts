/// <reference types="vite/client" />

import type { PlatformApi } from './platform/types'

declare global {
  interface Window {
    /** Present only under the Electron preload — go through platform() instead of reading this directly. */
    api?: PlatformApi
  }

  interface ImportMetaEnv {
    /** Your Ko-fi page, e.g. https://ko-fi.com/yourname */
    readonly VITE_KOFI_URL?: string
    /** Shown as "Made with ♥ by …" */
    readonly VITE_MAKER_NAME?: string
    /** Public source repo, enables "Star on GitHub" */
    readonly VITE_REPO_URL?: string
  }
}

export {}
