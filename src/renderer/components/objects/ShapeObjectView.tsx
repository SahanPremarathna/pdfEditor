import type Konva from 'konva'
import { Ellipse, Rect } from 'react-konva'
import { konvaTransformToObjectRect, ptToPx, pxToPt } from '../../core/coords'
import { useObjectStore } from '../../store/objectStore'
import type { ShapeObject } from '../../../shared/types'

interface ShapeObjectProps {
  obj: ShapeObject
  scale: number
  registerNode: (id: string, node: Konva.Node | null) => void
}

/** Renders rect/ellipse/highlight/whiteout — one component since all four
 *  share the same geometry (a rotatable box) and only differ in fill/stroke
 *  defaults and a couple of editor-only visual affordances. */
export default function ShapeObjectView({ obj, scale, registerNode }: ShapeObjectProps): JSX.Element {
  const selectObject = useObjectStore((s) => s.selectObject)
  const updateObject = useObjectStore((s) => s.updateObject)

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>): void => {
    e.cancelBubble = true
    selectObject(obj.id)
  }

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>): void => {
    const node = e.target
    updateObject(obj.pageIndex, obj.id, {
      x: pxToPt(node.x(), scale),
      y: pxToPt(node.y(), scale)
    })
  }

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>): void => {
    const node = e.target
    const snapshot = {
      x: node.x(),
      y: node.y(),
      width: node.width(),
      height: node.height(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      rotation: node.rotation()
    }
    node.scaleX(1)
    node.scaleY(1)
    updateObject(obj.pageIndex, obj.id, konvaTransformToObjectRect(snapshot, scale))
  }

  const widthPx = ptToPx(obj.width, scale)
  const heightPx = ptToPx(obj.height, scale)
  const isHighlight = obj.type === 'highlight'
  const isWhiteout = obj.type === 'whiteout'

  const shared = {
    x: ptToPx(obj.x, scale),
    y: ptToPx(obj.y, scale),
    width: widthPx,
    height: heightPx,
    rotation: obj.rotation,
    opacity: obj.opacity,
    fill: obj.fill ?? undefined,
    // Whiteout's own stroke is always null by design (see PropertiesPanel) —
    // this dashed outline is an editor-only affordance so an opaque white
    // box stays visible/selectable on a white page background. Never
    // exported: exportPdf draws whiteout with no border at all.
    stroke: isWhiteout ? '#94a3b8' : (obj.stroke ?? undefined),
    strokeWidth: isWhiteout ? 1 : ptToPx(obj.strokeWidth, scale),
    dash: isWhiteout ? [4, 4] : undefined,
    // Mirrors exportPdf's BlendMode.Multiply so the on-screen preview
    // matches the exported result.
    globalCompositeOperation: isHighlight ? ('multiply' as const) : undefined,
    draggable: !obj.locked,
    onClick: handleClick,
    onTap: handleClick,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd
  }

  if (obj.type === 'ellipse') {
    return (
      <Ellipse
        ref={(node) => registerNode(obj.id, node)}
        {...shared}
        radiusX={widthPx / 2}
        radiusY={heightPx / 2}
        // Konva's Ellipse is centered at its own (x,y); offsetting by
        // -half-size relocates the rotation pivot to the box's top-left
        // corner instead, matching Rect/Text's convention (and exportPdf's
        // rotatedObjectPoint derivation, which also pivots ellipses around
        // the top-left before offsetting to the center).
        offsetX={-widthPx / 2}
        offsetY={-heightPx / 2}
      />
    )
  }

  return <Rect ref={(node) => registerNode(obj.id, node)} {...shared} />
}
