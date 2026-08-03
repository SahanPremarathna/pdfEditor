import { findObjectById } from '../core/objects'
import { ON_SCREEN_FONT_FAMILIES } from '../core/fontFamilies'
import { useObjectStore } from '../store/objectStore'
import type { OnScreenFontFamily } from '../core/fontFamilies'

const buttonBase = 'h-7 w-7 rounded border text-sm'
const buttonInactive = 'border-slate-300 text-slate-600 hover:bg-slate-100'
const buttonActive = 'border-slate-800 bg-slate-800 text-white'

export default function PropertiesPanel(): JSX.Element | null {
  const objectsByPage = useObjectStore((s) => s.objectsByPage)
  const selectedId = useObjectStore((s) => s.selectedId)
  const updateObject = useObjectStore((s) => s.updateObject)
  const removeObject = useObjectStore((s) => s.removeObject)
  const bringToFront = useObjectStore((s) => s.bringToFront)
  const sendToBack = useObjectStore((s) => s.sendToBack)
  const bringForward = useObjectStore((s) => s.bringForward)
  const sendBackward = useObjectStore((s) => s.sendBackward)

  const obj = selectedId ? findObjectById(objectsByPage, selectedId) : undefined
  if (!obj) return null

  const patch = (p: Parameters<typeof updateObject>[2]): void => updateObject(obj.pageIndex, obj.id, p)

  return (
    <div className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-3 text-sm">
      <h2 className="font-semibold text-slate-700">Text properties</h2>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Font family</span>
        <select
          value={obj.fontFamily}
          onChange={(e) => patch({ fontFamily: e.target.value })}
          className="rounded border border-slate-300 px-2 py-1"
        >
          {ON_SCREEN_FONT_FAMILIES.map((family: OnScreenFontFamily) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Font size</span>
        <input
          type="number"
          min={1}
          value={obj.fontSize}
          onChange={(e) => patch({ fontSize: Number(e.target.value) })}
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Colour</span>
        <input
          type="color"
          value={obj.color}
          onChange={(e) => patch({ color: e.target.value })}
          className="h-8 w-full rounded border border-slate-300"
        />
      </label>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => patch({ bold: !obj.bold })}
          className={`${buttonBase} ${obj.bold ? buttonActive : buttonInactive} font-bold`}
          aria-pressed={obj.bold}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => patch({ italic: !obj.italic })}
          className={`${buttonBase} ${obj.italic ? buttonActive : buttonInactive} italic`}
          aria-pressed={obj.italic}
        >
          I
        </button>
      </div>

      <div className="flex gap-1">
        {(['left', 'center', 'right'] as const).map((align) => (
          <button
            key={align}
            type="button"
            onClick={() => patch({ align })}
            className={`${buttonBase} ${obj.align === align ? buttonActive : buttonInactive}`}
            aria-pressed={obj.align === align}
          >
            {align === 'left' ? '⟵' : align === 'center' ? '↔' : '⟶'}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Opacity ({Math.round(obj.opacity * 100)}%)</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={obj.opacity}
          onChange={(e) => patch({ opacity: Number(e.target.value) })}
        />
      </label>

      <div>
        <span className="text-xs text-slate-500">Order</span>
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            onClick={() => bringToFront(obj.pageIndex, obj.id)}
            className={`${buttonBase} ${buttonInactive}`}
            aria-label="Bring to front"
          >
            ⇈
          </button>
          <button
            type="button"
            onClick={() => bringForward(obj.pageIndex, obj.id)}
            className={`${buttonBase} ${buttonInactive}`}
            aria-label="Bring forward"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => sendBackward(obj.pageIndex, obj.id)}
            className={`${buttonBase} ${buttonInactive}`}
            aria-label="Send backward"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => sendToBack(obj.pageIndex, obj.id)}
            className={`${buttonBase} ${buttonInactive}`}
            aria-label="Send to back"
          >
            ⇊
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => removeObject(obj.pageIndex, obj.id)}
        className="mt-2 rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  )
}
