import { useEffect } from 'react'
import { fitWithinMaxDimension, readImageFile } from '../core/imageFiles'
import { createImageObject } from '../core/objects'
import { nextZ } from '../core/zOrder'
import { EMPTY_ARRAY, useObjectStore } from '../store/objectStore'
import { useUiStore } from '../store/uiStore'

const PASTE_DEFAULT_INSET_PT = 72
const PASTE_MAX_DIMENSION_PT = 200

/** Clipboard paste has no click position to derive a target page from, so a
 *  pasted image lands on `lastActivePageIndex` (the page a mousedown last
 *  happened on) at a fixed inset, ready to be dragged into place. */
export function useImagePasteHandler(): void {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      const items = e.clipboardData?.items
      if (!items) return
      const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'))
      if (!imageItem) return
      const file = imageItem.getAsFile()
      if (!file) return

      e.preventDefault()
      void readImageFile(file).then((loaded) => {
        const { lastActivePageIndex } = useUiStore.getState()
        const { objectsByPage, addObject, selectObject } = useObjectStore.getState()
        const { width, height } = fitWithinMaxDimension(loaded.width, loaded.height, PASTE_MAX_DIMENSION_PT)
        const z = nextZ(objectsByPage[lastActivePageIndex] ?? EMPTY_ARRAY)
        const obj = createImageObject(
          lastActivePageIndex,
          PASTE_DEFAULT_INSET_PT,
          PASTE_DEFAULT_INSET_PT,
          width,
          height,
          loaded.dataUrl,
          loaded.mime,
          z
        )
        addObject(obj)
        selectObject(obj.id)
      })
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])
}
