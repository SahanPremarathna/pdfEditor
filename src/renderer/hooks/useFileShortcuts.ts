import { useEffect } from 'react'
import { useDocumentStore } from '../store/documentStore'

/** Ctrl/Cmd+O to open, Ctrl/Cmd+Shift+S to save as. Mirrors useSaveShortcut's
 *  Ctrl+S, which already guards `!e.shiftKey` so the two never collide. */
export function useFileShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      const key = e.key.toLowerCase()
      if (key === 'o' && !e.shiftKey) {
        e.preventDefault()
        void useDocumentStore.getState().openFile()
      } else if (key === 's' && e.shiftKey) {
        e.preventDefault()
        void useDocumentStore.getState().saveAs()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
