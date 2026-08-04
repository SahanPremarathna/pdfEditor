import { useEffect } from 'react'
import { useHistoryStore } from '../core/history'

/** Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) to redo. Ignored while
 *  focus is inside the inline-edit textarea so it doesn't fight the
 *  textarea's own native undo (mirrors useDeleteSelectedObject's guard). */
export function useUndoRedoShortcut(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (document.activeElement instanceof HTMLTextAreaElement) return
      const isMod = e.ctrlKey || e.metaKey
      if (!isMod) return

      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) useHistoryStore.getState().redo()
        else useHistoryStore.getState().undo()
      } else if (key === 'y') {
        e.preventDefault()
        useHistoryStore.getState().redo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
