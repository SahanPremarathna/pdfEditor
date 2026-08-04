import { useEffect } from 'react'
import { useObjectStore } from '../store/objectStore'
import { useUiStore } from '../store/uiStore'

/**
 * Escape, ignored while a textarea is focused (matches useDeleteSelectedObject's
 * guard — TextEditOverlay's own local Escape handler, which cancels an
 * in-progress inline text edit, already runs first in the same synchronous
 * event dispatch and doesn't need stopPropagation for this to be a no-op
 * here). First-match-wins: closes the signature pad if open, else cancels an
 * active non-select tool back to 'select', else deselects the current object.
 */
export function useEscapeShortcut(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (document.activeElement instanceof HTMLTextAreaElement) return

      const ui = useUiStore.getState()
      if (ui.signatureRequest) {
        e.preventDefault()
        ui.clearSignatureRequest()
        ui.setActiveTool('select')
        return
      }
      if (ui.activeTool !== 'select') {
        e.preventDefault()
        ui.setActiveTool('select')
        return
      }
      if (useObjectStore.getState().selectedId) {
        e.preventDefault()
        useObjectStore.getState().selectObject(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
