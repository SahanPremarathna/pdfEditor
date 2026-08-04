import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { CH } from '../shared/channels'

const OPEN_RECENT_PREFIX = 'file:openRecent:'

/**
 * Builds the native menu. "Open this recent file" is encoded as a single
 * prefixed action string (`file:openRecent:<path>`) rather than a second
 * channel, since the renderer-facing `onMenuAction(cb: (action: string) => void)`
 * API only carries one string — the renderer dispatcher (useMenuActions)
 * splits on the prefix.
 */
async function buildMenu(win: BrowserWindow, getRecentFiles: () => Promise<string[]>): Promise<Menu> {
  const send = (action: string): void => win.webContents.send(CH.MENU_ACTION, action)

  const recentFiles = await getRecentFiles()
  const recentSubmenu: MenuItemConstructorOptions[] =
    recentFiles.length > 0
      ? recentFiles.map((path) => ({ label: path, click: () => send(`${OPEN_RECENT_PREFIX}${path}`) }))
      : [{ label: 'No Recent Files', enabled: false }]

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => send('file:open') },
        { label: 'Open Recent', submenu: recentSubmenu },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('file:save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('file:saveAs') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('edit:undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => send('edit:redo') },
        { type: 'separator' },
        { label: 'Delete', accelerator: 'Delete', click: () => send('edit:delete') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => send('view:zoomIn') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => send('view:zoomOut') },
        { label: 'Fit Width', accelerator: 'CmdOrCtrl+0', click: () => send('view:fitWidth') }
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}

/** Builds and installs the application menu, replacing whatever's currently
 *  set (including Electron's own default menu, the first time this runs). */
export async function setAppMenu(win: BrowserWindow, getRecentFiles: () => Promise<string[]>): Promise<void> {
  Menu.setApplicationMenu(await buildMenu(win, getRecentFiles))
}
