import { app, ipcMain } from 'electron'
import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CH } from '../../shared/channels'

const MAX_RECENT = 10

function recentFilesPath(): string {
  return join(app.getPath('userData'), 'recent-files.json')
}

/** Pure list management (dedupe, most-recent-first, capped) — unit-testable
 *  without touching fs, unlike the I/O wrappers below. */
export function addToRecentList(current: string[], path: string, max: number = MAX_RECENT): string[] {
  return [path, ...current.filter((p) => p !== path)].slice(0, max)
}

async function readRecentList(): Promise<string[]> {
  try {
    const raw = await readFile(recentFilesPath(), 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return [] // missing or corrupt file — start fresh, never throw
  }
}

async function writeRecentList(paths: string[]): Promise<void> {
  try {
    await writeFile(recentFilesPath(), JSON.stringify(paths))
  } catch {
    // Best-effort — a failed recent-files write should never surface as an
    // app-level error; it just means the list doesn't update this time.
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Reads the persisted list, pruning any entry whose file no longer exists
 *  on disk, so a stale recent-files list never offers a dead path. */
export async function getRecentFiles(): Promise<string[]> {
  const paths = await readRecentList()
  const checked = await Promise.all(paths.map(async (p) => ((await fileExists(p)) ? p : null)))
  return checked.filter((p): p is string => p !== null)
}

export async function addRecentFile(path: string): Promise<void> {
  const current = await readRecentList()
  await writeRecentList(addToRecentList(current, path))
}

export function registerRecentFilesHandlers(): void {
  ipcMain.handle(CH.RECENT_GET, () => getRecentFiles())
  ipcMain.handle(CH.RECENT_ADD, (_event, path: string) => addRecentFile(path))
}
