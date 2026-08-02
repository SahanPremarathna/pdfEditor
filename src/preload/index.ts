import { contextBridge, ipcRenderer } from 'electron'
import { CH } from '../shared/channels'
import type { OpenDialogResult } from '../shared/types'

const api = {
  openDialog: (): Promise<OpenDialogResult | null> => ipcRenderer.invoke(CH.OPEN_DIALOG),
  readFile: (path: string): Promise<Uint8Array> => ipcRenderer.invoke(CH.READ_FILE, path)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
