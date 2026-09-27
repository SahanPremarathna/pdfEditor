import { Eraser, Signature } from 'lucide-react'
import { useState } from 'react'
import { Layer, Line, Stage } from 'react-konva'
import type Konva from 'konva'
import { createPathObject } from '../core/objects'
import { nextZ } from '../core/zOrder'
import { EMPTY_ARRAY, useObjectStore } from '../store/objectStore'
import { useUiStore } from '../store/uiStore'
import Modal from './modals/Modal'

const PAD_MAX_WIDTH_PX = 440
const PAD_HEIGHT_PX = 170
const INK_COLORS = ['#111827', '#1d4ed8', '#6938ef']

/**
 * Opened whenever `uiStore.signatureRequest` is set (PageCanvas sets it on a
 * qualifying click while the signature tool is armed). Captures multiple
 * pen-lift strokes on its own small Konva Stage — signatures are vector
 * strokes, not a rasterized screenshot, per the spec's "real PDF content"
 * principle — and on "Done" creates one PathObject (type 'signature') at the
 * page/position the tool was armed at. Pointer events, so mouse, touch and
 * stylus all draw.
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
  const [ink, setInk] = useState(INK_COLORS[0])

  if (!signatureRequest) return null

  const padWidth = Math.min(PAD_MAX_WIDTH_PX, window.innerWidth - 72)

  const close = (): void => {
    setStrokes([])
    setCurrentStroke(null)
    clearSignatureRequest()
    setActiveTool('select')
  }

  const handlePointerDown = (e: Konva.KonvaEventObject<PointerEvent>): void => {
    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return
    setCurrentStroke([pos.x, pos.y])
  }

  const handlePointerMove = (e: Konva.KonvaEventObject<PointerEvent>): void => {
    if (!currentStroke) return
    const pos = e.target.getStage()?.getPointerPosition()
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
    const obj = createPathObject('signature', pageIndex, x, y, width, height, relativeStrokes, z, { stroke: ink })
    addObject(obj)
    selectObject(obj.id)
    close()
  }

  const hasContent = strokes.length > 0 || (currentStroke !== null && currentStroke.length >= 4)

  return (
    <Modal
      title="Draw your signature"
      subtitle="Use your mouse, finger or stylus."
      icon={<Signature size={18} />}
      onClose={close}
      widthClass="max-w-lg"
      footer={
        <>
          <button type="button" onClick={close} className="btn btn-ghost">
            Cancel
          </button>
          <button type="button" onClick={handleDone} disabled={!hasContent} className="btn btn-primary">
            Place signature
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-900/15 bg-white touch-none dark:border-white/15">
          <Stage
            width={padWidth}
            height={PAD_HEIGHT_PX}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={commitStroke}
            onPointerLeave={commitStroke}
          >
            <Layer>
              {strokes.map((stroke, i) => (
                <Line key={i} points={stroke} stroke={ink} strokeWidth={2} lineCap="round" lineJoin="round" />
              ))}
              {currentStroke && <Line points={currentStroke} stroke={ink} strokeWidth={2} lineCap="round" lineJoin="round" />}
            </Layer>
          </Stage>
          <div className="pointer-events-none absolute inset-x-8 bottom-8 border-b border-slate-300" />
          {!hasContent && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              Sign here
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {INK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setInk(color)}
                aria-label={`Ink colour ${color}`}
                aria-pressed={ink === color}
                className={`h-6 w-6 rounded-full border-2 transition ${ink === color ? 'scale-110 border-ink-400' : 'border-transparent'}
                  ${color === '#111827' ? 'bg-gray-900' : color === '#1d4ed8' ? 'bg-blue-700' : 'bg-ink-600'}`}
              />
            ))}
          </div>
          <button type="button" onClick={handleClear} className="btn btn-ghost h-8 px-2.5 text-xs" disabled={!hasContent}>
            <Eraser size={14} /> Clear
          </button>
        </div>
      </div>
    </Modal>
  )
}
