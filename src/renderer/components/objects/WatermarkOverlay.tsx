import type Konva from 'konva'
import { Image as KonvaImage, Text } from 'react-konva'
import { ptToPx, pxToPt } from '../../core/coords'
import { fontFamilyToCss } from '../../core/fontFamilies'
import { useHtmlImage } from '../../hooks/useHtmlImage'
import { useWatermarkStore } from '../../store/watermarkStore'
import type { WatermarkConfig } from '../../../shared/types'

interface WatermarkOverlayProps {
  config: WatermarkConfig
  widthPt: number
  heightPt: number
  scale: number
}

/**
 * Not a reuse of TextObjectView/ImageObjectView (both hard-wired to
 * objectStore's actions) — a small standalone, draggable-only preview (no
 * Transformer registration; resize/rotate are numeric controls in
 * WatermarkPanel instead, per the plan's decision). The caller (PageCanvas)
 * only renders this when config.enabled && this page's stable index is in
 * config.pageIndices, so no such check happens here.
 *
 * Dragging on one page updates the single shared fractional position in
 * watermarkStore — every other page currently mounted re-renders from that
 * same value immediately, and any page outside the virtualization window
 * picks it up the next time it mounts.
 */
export default function WatermarkOverlay({ config, widthPt, heightPt, scale }: WatermarkOverlayProps): JSX.Element | null {
  const setPosition = useWatermarkStore((s) => s.setPosition)
  // Called unconditionally regardless of config.type, per rules-of-hooks —
  // harmless when type is 'text' since `image` is simply never read below.
  const image = useHtmlImage(config.type === 'image' ? (config.dataUrl ?? '') : '')

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>): void => {
    const node = e.target
    setPosition(pxToPt(node.x(), scale) / widthPt, pxToPt(node.y(), scale) / heightPt)
  }

  const x = ptToPx(config.xFraction * widthPt, scale)
  const y = ptToPx(config.yFraction * heightPt, scale)

  if (config.type === 'text') {
    if (!config.text) return null
    return (
      <Text
        x={x}
        y={y}
        rotation={config.rotationDeg}
        opacity={config.opacity}
        text={config.text}
        fontSize={ptToPx(config.fontSize, scale)}
        fontFamily={fontFamilyToCss(config.fontFamily)}
        fill={config.color}
        draggable
        onDragEnd={handleDragEnd}
      />
    )
  }

  if (!config.dataUrl || !image) return null

  return (
    <KonvaImage
      image={image}
      x={x}
      y={y}
      width={ptToPx(config.naturalWidth * config.scale, scale)}
      height={ptToPx(config.naturalHeight * config.scale, scale)}
      rotation={config.rotationDeg}
      opacity={config.opacity}
      draggable
      onDragEnd={handleDragEnd}
    />
  )
}
