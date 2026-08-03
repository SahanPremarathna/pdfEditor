import type Konva from 'konva'
import { RenderingCancelledException } from 'pdfjs-dist'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Stage, Transformer } from 'react-konva'
import { pxToPt } from '../core/coords'
import { createTextObject } from '../core/objects'
import type { PDFDocumentProxy } from '../core/renderPdf'
import { renderPageToCanvas } from '../core/renderPdf'
import { nextZ } from '../core/zOrder'
import { EMPTY_ARRAY, useObjectStore } from '../store/objectStore'
import { useUiStore } from '../store/uiStore'
import TextEditOverlay from './objects/TextEditOverlay'
import TextObjectView from './objects/TextObject'

interface PageCanvasProps {
  pdfDoc: PDFDocumentProxy
  pageNumber: number // 1-indexed, per pdf.js convention
  pageIndex: number // 0-indexed, matches PageMeta.index and object.pageIndex
  widthPt: number
  heightPt: number
  scale: number // CSS px per PDF point
  active: boolean
}

export default function PageCanvas({
  pdfDoc,
  pageNumber,
  pageIndex,
  widthPt,
  heightPt,
  scale,
  active
}: PageCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runIdRef = useRef(0)
  const displayWidth = widthPt * scale
  const displayHeight = heightPt * scale
  const [error, setError] = useState<string | null>(null)

  const transformerRef = useRef<Konva.Transformer>(null)
  const nodeRefsRef = useRef(new Map<string, Konva.Text>())

  const objects = useObjectStore((s) => s.objectsByPage[pageIndex] ?? EMPTY_ARRAY)
  const selectedId = useObjectStore((s) => s.selectedId)
  const activeEditingId = useObjectStore((s) => s.activeEditingId)
  const addObject = useObjectStore((s) => s.addObject)
  const selectObject = useObjectStore((s) => s.selectObject)
  const startEditing = useObjectStore((s) => s.startEditing)

  const activeTool = useUiStore((s) => s.activeTool)
  const setActiveTool = useUiStore((s) => s.setActiveTool)

  const sortedObjects = useMemo(() => [...objects].sort((a, b) => a.z - b.z), [objects])
  const editingObject = objects.find((o) => o.id === activeEditingId)

  useEffect(() => {
    if (!active || !canvasRef.current) return undefined

    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const myRunId = ++runIdRef.current
    const isStale = (): boolean => runIdRef.current !== myRunId
    let cancelFn: (() => void) | null = null
    setError(null)

    renderPageToCanvas(pdfDoc, pageNumber, canvas, scale * dpr, isStale)
      .then((handle) => {
        if (!handle) return undefined // aborted before render() was ever called — nothing to cancel
        if (isStale()) {
          handle.cancel()
          return undefined
        }
        cancelFn = handle.cancel
        return handle.promise
      })
      .catch((err: unknown) => {
        if (isStale() || err instanceof RenderingCancelledException) return
        console.error(`Failed to render page ${pageNumber}`, err)
        setError(err instanceof Error ? err.message : 'Failed to render page')
      })

    return () => {
      cancelFn?.()
    }
  }, [pdfDoc, pageNumber, scale, active])

  // Reattaches the Transformer to the selected node whenever selection
  // changes, or when this page's Stage remounts after scrolling back into
  // the virtualization window (sortedObjects changing covers a remount,
  // since the ref map is rebuilt from scratch on mount).
  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return

    if (!selectedId || selectedId === activeEditingId) {
      transformer.nodes([])
      transformer.getLayer()?.batchDraw()
      return
    }

    const node = nodeRefsRef.current.get(selectedId)
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedId, activeEditingId, sortedObjects])

  const registerNode = (id: string, node: Konva.Text | null): void => {
    if (node) nodeRefsRef.current.set(id, node)
    else nodeRefsRef.current.delete(id)
  }

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>): void => {
    const stage = e.target.getStage()
    if (!stage || e.target !== stage) return // clicked an existing node, not empty background

    if (activeTool === 'text') {
      const pos = stage.getPointerPosition()
      if (!pos) return
      const obj = createTextObject(pageIndex, pxToPt(pos.x, scale), pxToPt(pos.y, scale), nextZ(objects))
      addObject(obj)
      selectObject(obj.id)
      startEditing(obj.id)
      setActiveTool('select')
    } else {
      selectObject(null)
    }
  }

  return (
    <div
      className="relative mx-auto mb-4 bg-white shadow"
      style={{ width: displayWidth, height: displayHeight }}
    >
      {active ? (
        <canvas
          ref={canvasRef}
          style={{ width: displayWidth, height: displayHeight, display: 'block' }}
        />
      ) : (
        <div className="h-full w-full bg-slate-200" />
      )}

      {active && (
        <Stage
          width={displayWidth}
          height={displayHeight}
          className="absolute inset-0"
          onMouseDown={handleStageMouseDown}
        >
          <Layer>
            {sortedObjects.map((obj) => (
              <TextObjectView
                key={obj.id}
                obj={obj}
                scale={scale}
                isEditing={activeEditingId === obj.id}
                registerNode={registerNode}
              />
            ))}
            <Transformer ref={transformerRef} rotateEnabled resizeEnabled />
          </Layer>
        </Stage>
      )}

      {active && editingObject && <TextEditOverlay obj={editingObject} scale={scale} />}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-2 text-center text-xs text-red-700">
          Page {pageNumber} failed to render: {error}
        </div>
      )}
    </div>
  )
}
