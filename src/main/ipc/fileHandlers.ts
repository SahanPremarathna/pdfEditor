import { dialog, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { CH } from '../../shared/channels'
import type { OpenDialogResult } from '../../shared/types'

export function registerFileHandlers(): void {
  ipcMain.handle(CH.OPEN_DIALOG, async (): Promise<OpenDialogResult | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const path = result.filePaths[0]
    const bytes = await readFile(path)
    return { path, bytes: new Uint8Array(bytes) }
  })

  ipcMain.handle(CH.READ_FILE, async (_event, path: string): Promise<Uint8Array> => {
    const bytes = await readFile(path)
    return new Uint8Array(bytes)
  })
}
