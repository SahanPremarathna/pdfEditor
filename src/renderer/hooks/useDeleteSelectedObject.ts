import { useEffect } from 'react'
import { findObjectById } from '../core/objects'
import { useObjectStore } from '../store/objectStore'

/** Deletes the currently-selected object on Delete/Backspace, ignored while
 *  focus is inside the inline-edit textarea so it doesn't fight the
 *  textarea's own backspace/delete-character behavior. */
export function useDeleteSelectedObject(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (document.activeElement instanceof HTMLTextAreaElement) return

      const { selectedId, objectsByPage, removeObject } = useObjectStore.getState()
      if (!selectedId) return
      const obj = findObjectById(objectsByPage, selectedId)
      if (!obj) return

      e.preventDefault()
      removeObject(obj.pageIndex, obj.id)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
