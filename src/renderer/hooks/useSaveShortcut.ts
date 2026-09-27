import { platform } from '../platform'
import { useEffect } from 'react'
import { useDocumentStore } from '../store/documentStore'

/** Ctrl/Cmd+S saves the current document. Unlike delete, this does NOT
 *  ignore textarea focus — Ctrl+S isn't a normal typing key and should still
 *  be intercepted (and preventDefault'ed, to stop the OS/browser's own save
 *  dialog) even mid-edit. Also handles the main process's save-before-close
 *  handshake: it asks the renderer to save, then reports success/failure so
 *  main knows whether it's safe to actually close the window. */
export function useSaveShortcut(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const isSaveCombo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !e.shiftKey
      if (!isSaveCombo) return
      e.preventDefault()
      void useDocumentStore.getState().save()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    return platform().onRequestSaveBeforeClose(() => {
      void useDocumentStore
        .getState()
        .save()
        .then(() => {
          const { isDirty, error } = useDocumentStore.getState()
          platform().notifySaveBeforeCloseResult(!isDirty && !error)
        })
    })
  }, [])
}
