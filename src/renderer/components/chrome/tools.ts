import {
  Circle,
  Eraser,
  Highlighter,
  ImagePlus,
  Minus,
  MousePointer2,
  MoveUpRight,
  PenLine,
  Signature,
  Square,
  Type,
  type LucideIcon
} from 'lucide-react'
import type { Tool } from '../../store/uiStore'

export interface ToolDef {
  id: Tool
  label: string
  /** Single-key shortcut (lowercase), shown in tooltips and the shortcuts sheet. */
  key: string
  icon: LucideIcon
  hint?: string
}

/** Grouped for the dock: selection, content, shapes, markup. */
export const TOOL_GROUPS: ToolDef[][] = [
  [{ id: 'select', label: 'Select', key: 'v', icon: MousePointer2, hint: 'Move, resize and rotate' }],
  [
    { id: 'text', label: 'Text', key: 't', icon: Type, hint: 'Click to place, type, Enter to finish' },
    { id: 'image', label: 'Image', key: 'i', icon: ImagePlus, hint: 'Click to place - or paste / drop an image' },
    { id: 'signature', label: 'Signature', key: 's', icon: Signature, hint: 'Click where the signature goes' }
  ],
  [
    { id: 'rect', label: 'Rectangle', key: 'r', icon: Square },
    { id: 'ellipse', label: 'Ellipse', key: 'e', icon: Circle },
    { id: 'line', label: 'Line', key: 'l', icon: Minus },
    { id: 'arrow', label: 'Arrow', key: 'a', icon: MoveUpRight }
  ],
  [
    { id: 'freehand', label: 'Draw', key: 'p', icon: PenLine, hint: 'Freehand pen' },
    { id: 'highlight', label: 'Highlight', key: 'h', icon: Highlighter },
    {
      id: 'whiteout',
      label: 'Whiteout',
      key: 'w',
      icon: Eraser,
      hint: 'Covers content visually - the text underneath is NOT removed'
    }
  ]
]

export const ALL_TOOLS: ToolDef[] = TOOL_GROUPS.flat()

export function toolForKey(key: string): ToolDef | undefined {
  const lower = key.toLowerCase()
  return ALL_TOOLS.find((t) => t.key === lower)
}
