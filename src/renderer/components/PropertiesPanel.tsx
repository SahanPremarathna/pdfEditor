import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  BringToFront,
  CopyPlus,
  Info,
  Italic,
  SendToBack,
  SlidersHorizontal,
  Trash2
} from 'lucide-react'
import { FONT_FAMILY_LABELS, ON_SCREEN_FONT_FAMILIES } from '../core/fontFamilies'
import { DEFAULT_SHAPE_FILL, DEFAULT_SHAPE_STROKE, findObjectById } from '../core/objects'
import { hasComplexScript } from '../core/unicodeText'
import { useObjectStore, type PdfObjectPatch } from '../store/objectStore'
import type { OnScreenFontFamily } from '../core/fontFamilies'
import type { PathObject, PdfObject, ShapeObject, TextObject } from '../../shared/types'
import PanelShell, { Field, NumberField } from './PanelShell'

interface TypedPatchProps<T extends PdfObject> {
  obj: T
  patch: (p: PdfObjectPatch) => void
}

function ToggleButton({
  active,
  onClick,
  label,
  children
}: {
  active: boolean
  onClick: () => void
  label: string
  children: JSX.Element
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`segmented-item ${active ? 'segmented-item-active' : ''}`}
    >
      {children}
    </button>
  )
}

function TextProperties({ obj, patch }: TypedPatchProps<TextObject>): JSX.Element {
  return (
    <>
      <Field label="Font">
        <select value={obj.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value })} className="input">
          {ON_SCREEN_FONT_FAMILIES.map((family: OnScreenFontFamily) => (
            <option key={family} value={family}>
              {FONT_FAMILY_LABELS[family]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Size" value={obj.fontSize} min={1} max={500} suffix="pt" onChange={(v) => patch({ fontSize: v })} />
        <NumberField
          label="Line height"
          value={obj.lineHeight}
          min={0.5}
          max={4}
          step={0.1}
          onChange={(v) => patch({ lineHeight: v })}
        />
      </div>

      <Field label="Colour">
        <input type="color" value={obj.color} onChange={(e) => patch({ color: e.target.value })} className="color-input" />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <div className="segmented">
          <ToggleButton active={obj.bold} onClick={() => patch({ bold: !obj.bold })} label="Bold">
            <Bold size={15} />
          </ToggleButton>
          <ToggleButton active={obj.italic} onClick={() => patch({ italic: !obj.italic })} label="Italic">
            <Italic size={15} />
          </ToggleButton>
        </div>
        <div className="segmented">
          {(
            [
              ['left', AlignLeft],
              ['center', AlignCenter],
              ['right', AlignRight]
            ] as const
          ).map(([align, Icon]) => (
            <ToggleButton key={align} active={obj.align === align} onClick={() => patch({ align })} label={`Align ${align}`}>
              <Icon size={15} />
            </ToggleButton>
          ))}
        </div>
      </div>

      {hasComplexScript(obj.text) && (
        <p className="flex gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
          <Info size={14} className="mt-px shrink-0" />
          Sinhala/Tamil text is embedded with Noto fonts; some conjuncts may render with simplified shaping.
        </p>
      )}
    </>
  )
}

function ShapeProperties({ obj, patch }: TypedPatchProps<ShapeObject>): JSX.Element {
  if (obj.type === 'whiteout') {
    return (
      <p className="flex gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
        <Info size={14} className="mt-px shrink-0" />
        Whiteout covers content opaquely - this hides pixels, it does not remove them. The text underneath can still be
        selected and extracted.
      </p>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <label className="flex flex-1 items-center gap-2">
          <input
            type="checkbox"
            className="checkbox"
            checked={obj.fill !== null}
            onChange={(e) => patch({ fill: e.target.checked ? DEFAULT_SHAPE_FILL : null })}
          />
          <span className="field-label">Fill</span>
        </label>
        {obj.fill !== null && (
          <input type="color" value={obj.fill} onChange={(e) => patch({ fill: e.target.value })} className="color-input w-16" />
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex flex-1 items-center gap-2">
          <input
            type="checkbox"
            className="checkbox"
            checked={obj.stroke !== null}
            onChange={(e) => patch({ stroke: e.target.checked ? DEFAULT_SHAPE_STROKE : null })}
          />
          <span className="field-label">Border</span>
        </label>
        {obj.stroke !== null && (
          <input type="color" value={obj.stroke} onChange={(e) => patch({ stroke: e.target.value })} className="color-input w-16" />
        )}
      </div>

      {obj.stroke !== null && (
        <NumberField
          label="Border width"
          value={obj.strokeWidth}
          min={0}
          max={50}
          step={0.5}
          suffix="pt"
          onChange={(v) => patch({ strokeWidth: v })}
        />
      )}
    </>
  )
}

function PathProperties({ obj, patch }: TypedPatchProps<PathObject>): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Colour">
        <input type="color" value={obj.stroke} onChange={(e) => patch({ stroke: e.target.value })} className="color-input" />
      </Field>
      <NumberField
        label="Width"
        value={obj.strokeWidth}
        min={0.5}
        max={50}
        step={0.5}
        suffix="pt"
        onChange={(v) => patch({ strokeWidth: v })}
      />
    </div>
  )
}

const OBJECT_TYPE_LABELS: Record<PdfObject['type'], string> = {
  text: 'Text',
  image: 'Image',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  arrow: 'Arrow',
  freehand: 'Drawing',
  highlight: 'Highlight',
  whiteout: 'Whiteout',
  signature: 'Signature'
}

export default function PropertiesPanel(): JSX.Element | null {
  const objectsByPage = useObjectStore((s) => s.objectsByPage)
  const selectedId = useObjectStore((s) => s.selectedId)
  const updateObject = useObjectStore((s) => s.updateObject)
  const removeObject = useObjectStore((s) => s.removeObject)
  const duplicateObject = useObjectStore((s) => s.duplicateObject)
  const selectObject = useObjectStore((s) => s.selectObject)
  const bringToFront = useObjectStore((s) => s.bringToFront)
  const sendToBack = useObjectStore((s) => s.sendToBack)
  const bringForward = useObjectStore((s) => s.bringForward)
  const sendBackward = useObjectStore((s) => s.sendBackward)

  const obj = selectedId ? findObjectById(objectsByPage, selectedId) : undefined
  if (!obj) return null

  const patch = (p: PdfObjectPatch): void => updateObject(obj.pageIndex, obj.id, p)
  const isPathLike = obj.type === 'line' || obj.type === 'arrow' || obj.type === 'freehand' || obj.type === 'signature'

  let typeSpecific: JSX.Element | null
  switch (obj.type) {
    case 'text':
      typeSpecific = <TextProperties obj={obj} patch={patch} />
      break
    case 'rect':
    case 'ellipse':
    case 'highlight':
    case 'whiteout':
      typeSpecific = <ShapeProperties obj={obj} patch={patch} />
      break
    case 'freehand':
    case 'line':
    case 'arrow':
    case 'signature':
      typeSpecific = <PathProperties obj={obj} patch={patch} />
      break
    case 'image':
      typeSpecific = null
      break
  }

  const orderButtons = [
    { label: 'Bring to front', icon: BringToFront, run: () => bringToFront(obj.pageIndex, obj.id) },
    { label: 'Bring forward', icon: ArrowUp, run: () => bringForward(obj.pageIndex, obj.id) },
    { label: 'Send backward', icon: ArrowDown, run: () => sendBackward(obj.pageIndex, obj.id) },
    { label: 'Send to back', icon: SendToBack, run: () => sendToBack(obj.pageIndex, obj.id) }
  ]

  return (
    <PanelShell
      title={OBJECT_TYPE_LABELS[obj.type]}
      icon={<SlidersHorizontal size={15} />}
      onClose={() => selectObject(null)}
      footer={
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline flex-1" onClick={() => duplicateObject(obj.id)}>
            <CopyPlus size={15} /> Duplicate
          </button>
          <button type="button" className="btn btn-danger flex-1" onClick={() => removeObject(obj.pageIndex, obj.id)}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      }
    >
      {typeSpecific}

      <Field label={`Opacity · ${Math.round(obj.opacity * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={obj.opacity}
          onChange={(e) => patch({ opacity: Number(e.target.value) })}
          className="range"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={obj.x} step={1} suffix="pt" onChange={(v) => patch({ x: v })} />
        <NumberField label="Y" value={obj.y} step={1} suffix="pt" onChange={(v) => patch({ y: v })} />
        {!isPathLike && (
          <>
            <NumberField label="Width" value={obj.width} min={1} step={1} suffix="pt" onChange={(v) => patch({ width: v })} />
            <NumberField label="Height" value={obj.height} min={1} step={1} suffix="pt" onChange={(v) => patch({ height: v })} />
          </>
        )}
        <NumberField
          label="Rotation"
          value={obj.rotation}
          min={-360}
          max={360}
          step={1}
          suffix="°"
          onChange={(v) => patch({ rotation: v })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="field-label">Arrange</span>
        <div className="segmented">
          {orderButtons.map(({ label, icon: Icon, run }) => (
            <button key={label} type="button" onClick={run} className="segmented-item tip tip-top" data-tip={label} aria-label={label}>
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>
    </PanelShell>
  )
}
