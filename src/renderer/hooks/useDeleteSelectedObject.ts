import { useEffect } from 'react'
import { findObjectById } from '../core/objects'
import { useObjectStore } from '../store/objectStore'

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
 *  focus is inside the inline-edit textarea so it doesn't fight the
 *  textarea's own backspace/delete-character behavior. */
export function useDeleteSelectedObject(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (document.activeElement instanceof HTMLTextAreaElement) return
      if (!useObjectStore.getState().selectedId) return

      e.preventDefault()
      deleteSelectedObject()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
