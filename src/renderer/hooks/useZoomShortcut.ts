import { useEffect } from 'react'
import { useUiStore } from '../store/uiStore'

/** Ctrl/Cmd+=/+ to zoom in, Ctrl/Cmd+- to zoom out, Ctrl/Cmd+0 to fit width. */
export function useZoomShortcut(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return

      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        useUiStore.getState().zoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        useUiStore.getState().zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        useUiStore.getState().setFitWidth(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
