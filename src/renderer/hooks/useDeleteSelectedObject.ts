import { useEffect } from 'react'
import { findObjectById } from '../core/objects'
import { useObjectStore } from '../store/objectStore'
import { isTypingTarget } from './useEditorShortcuts'

/** Removes whatever object is currently selected, if any — shared by the
 *  Delete/Backspace shortcut below and the native menu's Edit > Delete item. */
export function deleteSelectedObject(): void {
  const { selectedId, objectsByPage, removeObject } = useObjectStore.getState()
  if (!selectedId) return
  const obj = findObjectById(objectsByPage, selectedId)
  if (!obj) return
  removeObject(obj.pageIndex, obj.id)
}

/** Deletes the currently-selected object on Delete/Backspace, ignored while
 *  focus is in a text field (the inline-edit textarea, or any properties-panel
 *  input) so it doesn't fight that field's own backspace/delete behavior. */
export function useDeleteSelectedObject(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (isTypingTarget(document.activeElement)) return
      if (!useObjectStore.getState().selectedId) return

      e.preventDefault()
      deleteSelectedObject()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
