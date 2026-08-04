import { useState } from 'react'
import { Layer, Line, Stage } from 'react-konva'
import type Konva from 'konva'
import { createPathObject } from '../core/objects'
import { nextZ } from '../core/zOrder'
import { EMPTY_ARRAY, useObjectStore } from '../store/objectStore'
import { useUiStore } from '../store/uiStore'

const PAD_WIDTH_PX = 400
const PAD_HEIGHT_PX = 150

/**
 * Opened whenever `uiStore.signatureRequest` is set (PageCanvas sets it on a
 * qualifying click while the signature tool is armed). Captures multiple
 * pen-lift strokes on its own small Konva Stage — signatures are vector
 * strokes, not a rasterized screenshot, per the spec's "real PDF content"
 * principle — and on "Done" creates one PathObject (type 'signature') at the
 * page/position the tool was armed at.
 */
export default function SignaturePadModal(): JSX.Element | null {
  const signatureRequest = useUiStore((s) => s.signatureRequest)
  const clearSignatureRequest = useUiStore((s) => s.clearSignatureRequest)
  const setActiveTool = useUiStore((s) => s.setActiveTool)
  const addObject = useObjectStore((s) => s.addObject)
  const selectObject = useObjectStore((s) => s.selectObject)
  const objectsByPage = useObjectStore((s) => s.objectsByPage)

  const [strokes, setStrokes] = useState<number[][]>([])
  const [currentStroke, setCurrentStroke] = useState<number[] | null>(null)

  if (!signatureRequest) return null

  const close = (): void => {
    setStrokes([])
    setCurrentStroke(null)
    clearSignatureRequest()
    setActiveTool('select')
  }

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>): void => {
    const stage = e.target.getStage()
    const pos = stage?.getPointerPosition()
    if (!pos) return
    setCurrentStroke([pos.x, pos.y])
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>): void => {
    if (!currentStroke) return
    const stage = e.target.getStage()
    const pos = stage?.getPointerPosition()
    if (!pos) return
    setCurrentStroke([...currentStroke, pos.x, pos.y])
  }

  const commitStroke = (): void => {
    if (currentStroke && currentStroke.length >= 4) {
      setStrokes((prev) => [...prev, currentStroke])
    }
    setCurrentStroke(null)
  }

  const handleClear = (): void => {
    setStrokes([])
    setCurrentStroke(null)
  }

  const handleDone = (): void => {
    const allStrokes = currentStroke && currentStroke.length >= 4 ? [...strokes, currentStroke] : strokes
    if (allStrokes.length === 0) {
      close()
      return
    }

    const xs = allStrokes.flatMap((stroke) => stroke.filter((_, i) => i % 2 === 0))
    const ys = allStrokes.flatMap((stroke) => stroke.filter((_, i) => i % 2 === 1))
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const width = Math.max(1, Math.max(...xs) - minX)
    const height = Math.max(1, Math.max(...ys) - minY)
    const relativeStrokes = allStrokes.map((stroke) => stroke.map((v, i) => (i % 2 === 0 ? v - minX : v - minY)))

    const { pageIndex, x, y } = signatureRequest
    const z = nextZ(objectsByPage[pageIndex] ?? EMPTY_ARRAY)
    const obj = createPathObject('signature', pageIndex, x, y, width, height, relativeStrokes, z)
    addObject(obj)
    selectObject(obj.id)
    close()
  }

  const hasContent = strokes.length > 0 || (currentStroke !== null && currentStroke.length >= 4)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex flex-col gap-3 rounded bg-white p-4 shadow-lg">
        <h2 className="text-sm font-semibold text-slate-700">Draw your signature</h2>

        <div className="rounded border border-dashed border-slate-300 bg-slate-50">
          <Stage
            width={PAD_WIDTH_PX}
            height={PAD_HEIGHT_PX}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={commitStroke}
            onMouseLeave={commitStroke}
          >
            <Layer>
              {strokes.map((stroke, i) => (
                <Line key={i} points={stroke} stroke="#111827" strokeWidth={2} lineCap="round" lineJoin="round" />
              ))}
              {currentStroke && (
                <Line points={currentStroke} stroke="#111827" strokeWidth={2} lineCap="round" lineJoin="round" />
              )}
            </Layer>
          </Stage>
        </div>

        <div className="flex justify-between gap-2 text-sm">
          <button
            type="button"
            onClick={handleClear}
            className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              disabled={!hasContent}
              className="rounded bg-slate-800 px-3 py-1 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
