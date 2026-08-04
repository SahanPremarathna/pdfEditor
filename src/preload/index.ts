import { contextBridge, ipcRenderer } from 'electron'
import { CH } from '../shared/channels'
import type { OpenDialogResult } from '../shared/types'

const api = {
  openDialog: (): Promise<OpenDialogResult | null> => ipcRenderer.invoke(CH.OPEN_DIALOG),
  readFile: (path: string): Promise<Uint8Array> => ipcRenderer.invoke(CH.READ_FILE, path),
  save: (path: string, bytes: Uint8Array): Promise<void> => ipcRenderer.invoke(CH.SAVE, path, bytes),
  saveAs: (defaultName: string, bytes: Uint8Array): Promise<string | null> =>
    ipcRenderer.invoke(CH.SAVE_AS, defaultName, bytes),
  notifyDirty: (isDirty: boolean): void => ipcRenderer.send(CH.DIRTY_CHANGED, isDirty),
  onRequestSaveBeforeClose: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(CH.REQUEST_SAVE_BEFORE_CLOSE, listener)
    return () => ipcRenderer.off(CH.REQUEST_SAVE_BEFORE_CLOSE, listener)
  },
  notifySaveBeforeCloseResult: (success: boolean): void =>
    ipcRenderer.send(CH.SAVE_BEFORE_CLOSE_RESULT, success),
  getRecent: (): Promise<string[]> => ipcRenderer.invoke(CH.RECENT_GET),
  onMenuAction: (cb: (action: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string): void => cb(action)
    ipcRenderer.on(CH.MENU_ACTION, listener)
    return () => ipcRenderer.off(CH.MENU_ACTION, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
