import type Konva from 'konva'
import { Arrow, Group, Line } from 'react-konva'
import { konvaTransformToObjectRect, ptToPx, pxToPt, scalePathPoints } from '../../core/coords'
import { useObjectStore } from '../../store/objectStore'
import type { PathObject } from '../../../shared/types'

interface PathObjectProps {
  obj: PathObject
  scale: number
  registerNode: (id: string, node: Konva.Node | null) => void
}

/** Renders freehand/line/arrow/signature. `arrow` uses Konva's built-in
 *  `<Arrow>` (native pointerLength/pointerWidth, no hand-rolled on-screen
 *  arrowhead); the rest render each captured stroke as its own `<Line>`
 *  inside a shared `<Group>` so multi-stroke freehand/signature drag/resize/
 *  rotate as one unit through the same shared Transformer every other
 *  object type uses. */
export default function PathObjectView({ obj, scale, registerNode }: PathObjectProps): JSX.Element {
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
    // Konva bakes the resize into scaleX/scaleY, not the stored points — the
    // points need the same scale factor applied before it's reset, or the
    // shape's proportions would silently drift from its own width/height.
    const scaledPoints = scalePathPoints(obj.points, node.scaleX(), node.scaleY())
    node.scaleX(1)
    node.scaleY(1)
    updateObject(obj.pageIndex, obj.id, { ...konvaTransformToObjectRect(snapshot, scale), points: scaledPoints })
  }

  const strokeWidthPx = ptToPx(obj.strokeWidth, scale)
  const widthPx = ptToPx(obj.width, scale)
  const heightPx = ptToPx(obj.height, scale)

  if (obj.type === 'arrow') {
    const stroke = obj.points[0] ?? []
    const pointsPx = stroke.map((v) => ptToPx(v, scale))
    const pointerSizePx = Math.max(8, strokeWidthPx * 4)

    return (
      <Arrow
        ref={(node) => registerNode(obj.id, node)}
        x={ptToPx(obj.x, scale)}
        y={ptToPx(obj.y, scale)}
        width={widthPx}
        height={heightPx}
        points={pointsPx}
        stroke={obj.stroke}
        fill={obj.stroke}
        strokeWidth={strokeWidthPx}
        pointerLength={pointerSizePx}
        pointerWidth={pointerSizePx}
        rotation={obj.rotation}
        opacity={obj.opacity}
        draggable={!obj.locked}
        onClick={handleClick}
        onTap={handleClick}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
    )
  }

  return (
    <Group
      ref={(node) => registerNode(obj.id, node)}
      x={ptToPx(obj.x, scale)}
      y={ptToPx(obj.y, scale)}
      width={widthPx}
      height={heightPx}
      rotation={obj.rotation}
      opacity={obj.opacity}
      draggable={!obj.locked}
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {obj.points.map((stroke, i) => (
        <Line
          key={i}
          points={stroke.map((v) => ptToPx(v, scale))}
          stroke={obj.stroke}
          strokeWidth={strokeWidthPx}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      ))}
    </Group>
  )
}
