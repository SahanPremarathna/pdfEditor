import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { CH } from '../shared/channels'
import { registerFileHandlers } from './ipc/fileHandlers'
import { getRecentFiles, registerRecentFilesHandlers } from './ipc/recentFiles'
import { setAppMenu } from './menu'

// Single-window app: tracked at module scope rather than per-BrowserWindow.
let isDirty = false

function registerDirtyTracking(): void {
  ipcMain.on(CH.DIRTY_CHANGED, (_event, dirty: boolean) => {
    isDirty = dirty
  })
}

/**
 * Intercepts window close while the document has unsaved changes and shows
 * a Save/Don't Save/Cancel confirmation. "Save" needs the renderer to
 * actually produce export bytes (only exportPdf.ts, renderer-side, can do
 * that), so that path sends a one-shot request and waits for the reply
 * before deciding whether to destroy the window.
 */
function registerCloseGuard(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (!isDirty) return
    event.preventDefault()

    void dialog
      .showMessageBox(win, {
        type: 'warning',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        message: 'You have unsaved changes.',
        detail: 'Do you want to save your changes before closing?'
      })
      .then(({ response }) => {
        if (response === 1) {
          // Don't Save
          isDirty = false
          win.destroy()
        } else if (response === 0) {
          // Save
          const onResult = (_event: Electron.IpcMainEvent, success: boolean): void => {
            ipcMain.off(CH.SAVE_BEFORE_CLOSE_RESULT, onResult)
            if (success) {
              isDirty = false
              win.destroy()
            }
            // if save failed/was cancelled (e.g. Save-As dialog dismissed), leave the window open
          }
          ipcMain.on(CH.SAVE_BEFORE_CLOSE_RESULT, onResult)
          win.webContents.send(CH.REQUEST_SAVE_BEFORE_CLOSE)
        }
        // Cancel (response 2): do nothing, window stays open
      })
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  win.once('ready-to-show', () => win.show())
  registerCloseGuard(win)

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
    win.webContents.openDevTools()
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  void setAppMenu(win, getRecentFiles)
  return win
}

void app.whenReady().then(() => {
  registerFileHandlers()
  registerRecentFilesHandlers()
  registerDirtyTracking()
  const win = createWindow()

  // Refreshes the "Open Recent" submenu (e.g. after a save/open elsewhere
  // added an entry) whenever the window regains focus, without needing to
  // thread a callback through fileHandlers.ts/recentFiles.ts.
  app.on('browser-window-focus', () => {
    void setAppMenu(win, getRecentFiles)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
