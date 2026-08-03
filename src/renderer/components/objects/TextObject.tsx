import type Konva from 'konva'
import { Text } from 'react-konva'
import { konvaTransformToObjectRect, ptToPx, pxToPt } from '../../core/coords'
import { fontFamilyToCss } from '../../core/fontFamilies'
import { useObjectStore } from '../../store/objectStore'
import type { TextObject as TextObjectModel } from '../../../shared/types'

interface TextObjectProps {
  obj: TextObjectModel
  scale: number
  isEditing: boolean
  registerNode: (id: string, node: Konva.Text | null) => void
}

function fontStyleFor(obj: TextObjectModel): string {
  const parts: string[] = []
  if (obj.italic) parts.push('italic')
  if (obj.bold) parts.push('bold')
  return parts.length > 0 ? parts.join(' ') : 'normal'
}

export default function TextObject({ obj, scale, isEditing, registerNode }: TextObjectProps): JSX.Element {
  const selectObject = useObjectStore((s) => s.selectObject)
  const startEditing = useObjectStore((s) => s.startEditing)
  const updateObject = useObjectStore((s) => s.updateObject)

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>): void => {
    e.cancelBubble = true
    selectObject(obj.id)
  }

  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>): void => {
    e.cancelBubble = true
    if (obj.locked) return
    selectObject(obj.id)
    startEditing(obj.id)
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
    // Konva bakes a Transformer resize into scale, not width/height — reset
    // immediately or the next resize compounds on top of this one.
    node.scaleX(1)
    node.scaleY(1)
    updateObject(obj.pageIndex, obj.id, konvaTransformToObjectRect(snapshot, scale))
  }

  return (
    <Text
      ref={(node) => registerNode(obj.id, node)}
      visible={!isEditing}
      x={ptToPx(obj.x, scale)}
      y={ptToPx(obj.y, scale)}
      width={ptToPx(obj.width, scale)}
      height={ptToPx(obj.height, scale)}
      rotation={obj.rotation}
      opacity={obj.opacity}
      text={obj.text}
      fontSize={ptToPx(obj.fontSize, scale)}
      fontFamily={fontFamilyToCss(obj.fontFamily)}
      fontStyle={fontStyleFor(obj)}
      fill={obj.color}
      align={obj.align}
      lineHeight={obj.lineHeight}
      draggable={!obj.locked}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDblClick}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    />
  )
}
