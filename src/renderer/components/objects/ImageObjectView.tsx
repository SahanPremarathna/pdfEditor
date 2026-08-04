import type Konva from 'konva'
import { Image as KonvaImage } from 'react-konva'
import { konvaTransformToObjectRect, ptToPx, pxToPt } from '../../core/coords'
import { useHtmlImage } from '../../hooks/useHtmlImage'
import { useObjectStore } from '../../store/objectStore'
import type { ImageObject } from '../../../shared/types'

interface ImageObjectProps {
  obj: ImageObject
  scale: number
  registerNode: (id: string, node: Konva.Node | null) => void
}

export default function ImageObjectView({ obj, scale, registerNode }: ImageObjectProps): JSX.Element | null {
  const selectObject = useObjectStore((s) => s.selectObject)
  const updateObject = useObjectStore((s) => s.updateObject)
  const image = useHtmlImage(obj.dataUrl)

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

  if (!image) return null

  return (
    <KonvaImage
      ref={(node) => registerNode(obj.id, node)}
      image={image}
      x={ptToPx(obj.x, scale)}
      y={ptToPx(obj.y, scale)}
      width={ptToPx(obj.width, scale)}
      height={ptToPx(obj.height, scale)}
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
