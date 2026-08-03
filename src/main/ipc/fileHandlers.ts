import { app, dialog, ipcMain } from 'electron'
import { isAbsolute, resolve, sep } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { CH } from '../../shared/channels'
import type { OpenDialogResult } from '../../shared/types'

/**
 * Proportionate defense-in-depth against a compromised renderer sending an
 * arbitrary path to SAVE — not a full sandbox. Rejects relative paths and
 * anything inside the app's own install directory.
 */
function assertSafeSavePath(path: string): void {
  if (!isAbsolute(path)) {
    throw new Error(`Refusing to save to a non-absolute path: ${path}`)
  }
  const resolved = resolve(path)
  const appPath = resolve(app.getAppPath())
  if (resolved === appPath || resolved.startsWith(appPath + sep)) {
    throw new Error(`Refusing to save inside the application directory: ${path}`)
  }
}

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

  ipcMain.handle(CH.SAVE, async (_event, path: string, bytes: Uint8Array): Promise<void> => {
    assertSafeSavePath(path)
    await writeFile(path, bytes)
  })

  ipcMain.handle(CH.SAVE_AS, async (_event, defaultName: string, bytes: Uint8Array): Promise<string | null> => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null

    assertSafeSavePath(result.filePath)
    await writeFile(result.filePath, bytes)
    return result.filePath
  })
}
