import { useEffect } from 'react'
import { useHistoryStore } from '../core/history'
import { useDocumentStore } from '../store/documentStore'
import { useUiStore } from '../store/uiStore'
import { deleteSelectedObject } from './useDeleteSelectedObject'

const OPEN_RECENT_PREFIX = 'file:openRecent:'
const OPEN_LAUNCH_PATH_PREFIX = 'file:openLaunchPath:'

/** Dispatches native-menu clicks (main process, via menu.ts) to the matching
 *  store call — structurally identical to useSaveShortcut's existing
 *  window.api.onRequestSaveBeforeClose wiring. */
export function useMenuActions(): void {
  useEffect(() => {
    return window.api.onMenuAction((action) => {
      if (action.startsWith(OPEN_RECENT_PREFIX)) {
        void useDocumentStore.getState().openPath(action.slice(OPEN_RECENT_PREFIX.length))
        return
      }
      if (action.startsWith(OPEN_LAUNCH_PATH_PREFIX)) {
        void useDocumentStore.getState().openPath(action.slice(OPEN_LAUNCH_PATH_PREFIX.length))
        return
      }

      switch (action) {
        case 'file:open':
          void useDocumentStore.getState().openFile()
          break
        case 'file:save':
          void useDocumentStore.getState().save()
          break
        case 'file:saveAs':
          void useDocumentStore.getState().saveAs()
          break
        case 'edit:undo':
          useHistoryStore.getState().undo()
          break
        case 'edit:redo':
          useHistoryStore.getState().redo()
          break
        case 'edit:delete':
          deleteSelectedObject()
          break
        case 'view:zoomIn':
          useUiStore.getState().zoomIn()
          break
        case 'view:zoomOut':
          useUiStore.getState().zoomOut()
          break
        case 'view:fitWidth':
          useUiStore.getState().setFitWidth(true)
          break
      }
    })
  }, [])
}
