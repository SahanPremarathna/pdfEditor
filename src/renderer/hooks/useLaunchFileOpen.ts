import { platform } from '../platform'
import { useEffect } from 'react'
import { useDocumentStore } from '../store/documentStore'

/**
 * Cold-start counterpart to useMenuActions' `file:openLaunchPath:` handling:
 * when TrueFreePDF itself was launched by double-clicking a .pdf (or "Open
 * with"), main resolves the path once from its own process.argv and exposes
 * it via a pull (window.api.getLaunchPath), not a push over onMenuAction —
 * an event sent before this effect has run and registered its listener would
 * be silently dropped.
 */
export function useLaunchFileOpen(): void {
  useEffect(() => {
    void platform().getLaunchPath().then((path) => {
      if (path) void useDocumentStore.getState().openPath(path)
    })
  }, [])
}
