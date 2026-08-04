import type Konva from 'konva'
import { RenderingCancelledException } from 'pdfjs-dist'
import type { ChangeEvent, DragEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Ellipse, Layer, Line, Rect, Stage, Transformer } from 'react-konva'
import { pxToPt } from '../core/coords'
import { fitWithinMaxDimension, readImageFile } from '../core/imageFiles'
import { createImageObject, createPathObject, createShapeObject, createTextObject } from '../core/objects'
import type { ResolvedPageSource } from '../core/pageSources'
import { renderPageToCanvas } from '../core/renderPdf'
import { nextZ } from '../core/zOrder'
import { EMPTY_ARRAY, useObjectStore } from '../store/objectStore'
import { useUiStore, type Tool } from '../store/uiStore'
import ImageObjectView from './objects/ImageObjectView'
import PathObjectView from './objects/PathObjectView'
import ShapeObjectView from './objects/ShapeObjectView'
import TextEditOverlay from './objects/TextEditOverlay'
import TextObjectView from './objects/TextObject'
import type { PdfObject, TextObject } from '../../shared/types'

interface PageCanvasProps {
  /** What to actually render — either a pdfjs doc+page number (original or
   *  imported), or 'blank' for an inserted page with no pdfjs source at all. */
  source: ResolvedPageSource
  pageIndex: number // stable PageMeta.index, matches object.pageIndex — NOT array position
  widthPt: number
  heightPt: number
  scale: number // CSS px per PDF point
  active: boolean
}

const BOX_TOOLS: ReadonlySet<Tool> = new Set(['rect', 'ellipse', 'highlight', 'whiteout'])
const LINE_TOOLS: ReadonlySet<Tool> = new Set(['line', 'arrow'])
const MIN_DRAG_PX = 4
const FREEHAND_MIN_POINT_DISTANCE_PX = 3
const IMAGE_MAX_DIMENSION_PT = 300
const DRAFT_PREVIEW_COLOR = '#64748b'

type BoxTool = 'rect' | 'ellipse' | 'highlight' | 'whiteout'
type LineTool = 'line' | 'arrow'

type Draft =
  | { kind: 'box'; tool: BoxTool; start: Konva.Vector2d; current: Konva.Vector2d }
  | { kind: 'line'; tool: LineTool; start: Konva.Vector2d; current: Konva.Vector2d }
  | { kind: 'freehand'; points: number[] }

export default function PageCanvas({
  source,
  pageIndex,
  widthPt,
  heightPt,
  scale,
  active
}: PageCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const runIdRef = useRef(0)
  const displayWidth = widthPt * scale
  const displayHeight = heightPt * scale
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pendingImagePlacement, setPendingImagePlacement] = useState<{ xPt: number; yPt: number } | null>(null)

  const transformerRef = useRef<Konva.Transformer>(null)
  const nodeRefsRef = useRef(new Map<string, Konva.Node>())

  const objects = useObjectStore((s) => s.objectsByPage[pageIndex] ?? EMPTY_ARRAY)
  const selectedId = useObjectStore((s) => s.selectedId)
  const activeEditingId = useObjectStore((s) => s.activeEditingId)
  const addObject = useObjectStore((s) => s.addObject)
  const selectObject = useObjectStore((s) => s.selectObject)
  const startEditing = useObjectStore((s) => s.startEditing)

  const activeTool = useUiStore((s) => s.activeTool)
  const setActiveTool = useUiStore((s) => s.setActiveTool)
  const setLastActivePageIndex = useUiStore((s) => s.setLastActivePageIndex)
  const requestSignature = useUiStore((s) => s.requestSignature)

  const sortedObjects = useMemo(() => [...objects].sort((a, b) => a.z - b.z), [objects])
  const editingObject = objects.find((o): o is TextObject => o.type === 'text' && o.id === activeEditingId)

  const isBlank = source.kind === 'blank'
  const sourcePdfDoc = source.kind === 'renderable' ? source.pdfDoc : null
  const sourcePageNumber = source.kind === 'renderable' ? source.pageNumber : null
  const sourceRotationDeg = source.kind === 'renderable' ? source.rotationDeg : 0

  useEffect(() => {
    if (!active || !canvasRef.current || !sourcePdfDoc || sourcePageNumber === null) return undefined

    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const myRunId = ++runIdRef.current
    const isStale = (): boolean => runIdRef.current !== myRunId
    let cancelFn: (() => void) | null = null
    setError(null)

    renderPageToCanvas(sourcePdfDoc, sourcePageNumber, canvas, scale * dpr, isStale, sourceRotationDeg)
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
        console.error('Failed to render page', err)
        setError(err instanceof Error ? err.message : 'Failed to render page')
      })

    return () => {
      cancelFn?.()
    }
  }, [sourcePdfDoc, sourcePageNumber, sourceRotationDeg, scale, active])

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

  const registerNode = (id: string, node: Konva.Node | null): void => {
    if (node) nodeRefsRef.current.set(id, node)
    else nodeRefsRef.current.delete(id)
  }

  const placeImage = (file: File, xPt: number, yPt: number): void => {
    void readImageFile(file).then((loaded) => {
      const { width, height } = fitWithinMaxDimension(loaded.width, loaded.height, IMAGE_MAX_DIMENSION_PT)
      const obj = createImageObject(pageIndex, xPt, yPt, width, height, loaded.dataUrl, loaded.mime, nextZ(objects))
      addObject(obj)
      selectObject(obj.id)
    })
  }

  const commitDraft = (d: Draft): void => {
    if (d.kind === 'box') {
      const x0 = Math.min(d.start.x, d.current.x)
      const y0 = Math.min(d.start.y, d.current.y)
      const wPx = Math.abs(d.current.x - d.start.x)
      const hPx = Math.abs(d.current.y - d.start.y)
      if (Math.max(wPx, hPx) < MIN_DRAG_PX) return

      const obj = createShapeObject(
        d.tool,
        pageIndex,
        pxToPt(x0, scale),
        pxToPt(y0, scale),
        pxToPt(wPx, scale),
        pxToPt(hPx, scale),
        nextZ(objects)
      )
      addObject(obj)
      selectObject(obj.id)
      setActiveTool('select')
      return
    }

    if (d.kind === 'line') {
      const distPx = Math.hypot(d.current.x - d.start.x, d.current.y - d.start.y)
      if (distPx < MIN_DRAG_PX) return

      const x0 = Math.min(d.start.x, d.current.x)
      const y0 = Math.min(d.start.y, d.current.y)
      const points = [
        [
          pxToPt(d.start.x - x0, scale),
          pxToPt(d.start.y - y0, scale),
          pxToPt(d.current.x - x0, scale),
          pxToPt(d.current.y - y0, scale)
        ]
      ]
      const obj = createPathObject(
        d.tool,
        pageIndex,
        pxToPt(x0, scale),
        pxToPt(y0, scale),
        pxToPt(Math.abs(d.current.x - d.start.x), scale),
        pxToPt(Math.abs(d.current.y - d.start.y), scale),
        points,
        nextZ(objects)
      )
      addObject(obj)
      selectObject(obj.id)
      setActiveTool('select')
      return
    }

    // freehand
    if (d.points.length < 4) return
    const xs = d.points.filter((_, i) => i % 2 === 0)
    const ys = d.points.filter((_, i) => i % 2 === 1)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const wPx = Math.max(...xs) - minX
    const hPx = Math.max(...ys) - minY
    if (Math.max(wPx, hPx) < MIN_DRAG_PX) return

    const relativePt = d.points.map((v, i) => pxToPt(i % 2 === 0 ? v - minX : v - minY, scale))
    const obj = createPathObject(
      'freehand',
      pageIndex,
      pxToPt(minX, scale),
      pxToPt(minY, scale),
      pxToPt(wPx, scale),
      pxToPt(hPx, scale),
      [relativePt],
      nextZ(objects)
    )
    addObject(obj)
    selectObject(obj.id)
    setActiveTool('select')
  }

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>): void => {
    setLastActivePageIndex(pageIndex)

    const stage = e.target.getStage()
    if (!stage || e.target !== stage) return // clicked an existing node, not empty background
    const pos = stage.getPointerPosition()
    if (!pos) return

    if (activeTool === 'text') {
      const obj = createTextObject(pageIndex, pxToPt(pos.x, scale), pxToPt(pos.y, scale), nextZ(objects))
      addObject(obj)
      selectObject(obj.id)
      startEditing(obj.id)
      setActiveTool('select')
      return
    }

    if (activeTool === 'image') {
      setPendingImagePlacement({ xPt: pxToPt(pos.x, scale), yPt: pxToPt(pos.y, scale) })
      fileInputRef.current?.click()
      return
    }

    if (activeTool === 'signature') {
      requestSignature(pageIndex, pxToPt(pos.x, scale), pxToPt(pos.y, scale))
      return
    }

    if (BOX_TOOLS.has(activeTool)) {
      setDraft({ kind: 'box', tool: activeTool as BoxTool, start: pos, current: pos })
      return
    }

    if (LINE_TOOLS.has(activeTool)) {
      setDraft({ kind: 'line', tool: activeTool as LineTool, start: pos, current: pos })
      return
    }

    if (activeTool === 'freehand') {
      setDraft({ kind: 'freehand', points: [pos.x, pos.y] })
      return
    }

    selectObject(null)
  }

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>): void => {
    if (!draft) return
    const stage = e.target.getStage()
    const pos = stage?.getPointerPosition()
    if (!pos) return

    if (draft.kind !== 'freehand') {
      setDraft({ ...draft, current: pos })
      return
    }

    const lastX = draft.points[draft.points.length - 2]
    const lastY = draft.points[draft.points.length - 1]
    const dx = pos.x - lastX
    const dy = pos.y - lastY
    if (dx * dx + dy * dy < FREEHAND_MIN_POINT_DISTANCE_PX * FREEHAND_MIN_POINT_DISTANCE_PX) return
    setDraft({ kind: 'freehand', points: [...draft.points, pos.x, pos.y] })
  }

  const handleStageMouseUp = (): void => {
    if (!draft) return
    commitDraft(draft)
    setDraft(null)
  }

  const handleImageFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const placement = pendingImagePlacement
    setPendingImagePlacement(null)
    setActiveTool('select')
    if (!file || !placement) return
    placeImage(file, placement.xPt, placement.yPt)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) return
    e.preventDefault()

    const rect = e.currentTarget.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const yPx = e.clientY - rect.top
    placeImage(file, pxToPt(xPx, scale), pxToPt(yPx, scale))
  }

  const renderObject = (obj: PdfObject): JSX.Element => {
    switch (obj.type) {
      case 'text':
        return (
          <TextObjectView
            key={obj.id}
            obj={obj}
            scale={scale}
            isEditing={activeEditingId === obj.id}
            registerNode={registerNode}
          />
        )
      case 'image':
        return <ImageObjectView key={obj.id} obj={obj} scale={scale} registerNode={registerNode} />
      case 'rect':
      case 'ellipse':
      case 'highlight':
      case 'whiteout':
        return <ShapeObjectView key={obj.id} obj={obj} scale={scale} registerNode={registerNode} />
      case 'freehand':
      case 'line':
      case 'arrow':
      case 'signature':
        return <PathObjectView key={obj.id} obj={obj} scale={scale} registerNode={registerNode} />
    }
  }

  return (
    <div
      className="relative mx-auto mb-4 bg-white shadow"
      style={{ width: displayWidth, height: displayHeight }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isBlank ? (
        <div className="h-full w-full bg-white" />
      ) : active ? (
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
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
        >
          <Layer>
            {sortedObjects.map(renderObject)}

            {draft?.kind === 'box' &&
              (draft.tool === 'ellipse' ? (
                <Ellipse
                  x={(draft.start.x + draft.current.x) / 2}
                  y={(draft.start.y + draft.current.y) / 2}
                  radiusX={Math.abs(draft.current.x - draft.start.x) / 2}
                  radiusY={Math.abs(draft.current.y - draft.start.y) / 2}
                  stroke={DRAFT_PREVIEW_COLOR}
                  dash={[4, 4]}
                  listening={false}
                />
              ) : (
                <Rect
                  x={Math.min(draft.start.x, draft.current.x)}
                  y={Math.min(draft.start.y, draft.current.y)}
                  width={Math.abs(draft.current.x - draft.start.x)}
                  height={Math.abs(draft.current.y - draft.start.y)}
                  stroke={DRAFT_PREVIEW_COLOR}
                  dash={[4, 4]}
                  listening={false}
                />
              ))}
            {draft?.kind === 'line' && (
              <Line
                points={[draft.start.x, draft.start.y, draft.current.x, draft.current.y]}
                stroke={DRAFT_PREVIEW_COLOR}
                dash={[4, 4]}
                listening={false}
              />
            )}
            {draft?.kind === 'freehand' && (
              <Line
                points={draft.points}
                stroke={DRAFT_PREVIEW_COLOR}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            )}

            <Transformer ref={transformerRef} rotateEnabled resizeEnabled />
          </Layer>
        </Stage>
      )}

      {active && editingObject && <TextEditOverlay obj={editingObject} scale={scale} />}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleImageFileChange}
      />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-2 text-center text-xs text-red-700">
          This page failed to render: {error}
        </div>
      )}
    </div>
  )
}
