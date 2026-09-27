import { useEffect } from 'react'
import { toolForKey } from '../components/chrome/tools'
import { findObjectById } from '../core/objects'
import { useDocumentStore } from '../store/documentStore'
import { useObjectStore } from '../store/objectStore'
import { useUiStore } from '../store/uiStore'

const NUDGE_PT = 1
const NUDGE_LARGE_PT = 10

const ARROW_DELTAS: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 }
}

/** True while focus is somewhere keystrokes belong to (inputs, the inline
 *  text editor, contenteditable) — single-key shortcuts must stay out of it. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * Editor-wide keys that aren't file/zoom/undo commands:
 * - single letters arm a tool (V select, T text, R rect, ...)
 * - arrows nudge the selected object by 1pt (Shift: 10pt) — each press is
 *   its own undo step, through objectStore.updateObject like any other edit
 * - Ctrl/Cmd+D duplicates the selected object
 * - ? opens the shortcuts sheet
 */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target) || e.defaultPrevented) return
      const ui = useUiStore.getState()
      if (ui.activeModal || ui.signatureRequest || useDocumentStore.getState().passwordPrompt) return

      const mod = e.ctrlKey || e.metaKey
      const objects = useObjectStore.getState()

      if (mod && !e.shiftKey && e.key.toLowerCase() === 'd') {
        if (!objects.selectedId) return
        e.preventDefault()
        objects.duplicateObject(objects.selectedId)
        return
      }

      const arrow = ARROW_DELTAS[e.key]
      if (arrow && !mod && objects.selectedId) {
        const obj = findObjectById(objects.objectsByPage, objects.selectedId)
        if (!obj || obj.locked) return
        e.preventDefault()
        const step = e.shiftKey ? NUDGE_LARGE_PT : NUDGE_PT
        objects.updateObject(obj.pageIndex, obj.id, { x: obj.x + arrow.dx * step, y: obj.y + arrow.dy * step })
        return
      }

      if (mod || e.altKey) return

      if (e.key === '?') {
        e.preventDefault()
        ui.openModal('shortcuts')
        return
      }

      if (!useDocumentStore.getState().pdfDoc) return
      const tool = toolForKey(e.key)
      if (tool) {
        e.preventDefault()
        ui.setActiveTool(tool.id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
