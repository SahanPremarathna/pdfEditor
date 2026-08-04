import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { ON_SCREEN_FONT_FAMILIES } from '../core/fontFamilies'
import { readImageFile } from '../core/imageFiles'
import { useDocumentStore } from '../store/documentStore'
import { useUiStore } from '../store/uiStore'
import { useWatermarkStore } from '../store/watermarkStore'
import type { OnScreenFontFamily } from '../core/fontFamilies'

const buttonBase = 'h-7 flex-1 rounded border text-sm'
const buttonInactive = 'border-slate-300 text-slate-600 hover:bg-slate-100'
const buttonActive = 'border-slate-800 bg-slate-800 text-white'

export default function WatermarkPanel(): JSX.Element {
  const config = useWatermarkStore((s) => s.config)
  const setType = useWatermarkStore((s) => s.setType)
  const updateConfig = useWatermarkStore((s) => s.updateConfig)
  const setImageContent = useWatermarkStore((s) => s.setImageContent)
  const setRangeInput = useWatermarkStore((s) => s.setRangeInput)
  const applyRange = useWatermarkStore((s) => s.applyRange)
  const setWatermarkPanelOpen = useUiStore((s) => s.setWatermarkPanelOpen)

  const visiblePageCount = useDocumentStore((s) => s.pages.filter((p) => !p.deleted).length)

  const [rangeFrom, setRangeFrom] = useState(config.rangeInput?.from ?? 1)
  const [rangeTo, setRangeTo] = useState(config.rangeInput?.to ?? Math.max(1, visiblePageCount))

  const handleRangeChange = (from: number, to: number): void => {
    setRangeFrom(from)
    setRangeTo(to)
    setRangeInput(from, to)
  }

  const handleImageFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void readImageFile(file).then((loaded) => setImageContent(loaded.dataUrl, loaded.mime, loaded.width, loaded.height))
  }

  return (
    <div className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">Watermark</h2>
        <button
          type="button"
          onClick={() => setWatermarkPanelOpen(false)}
          aria-label="Close watermark panel"
          className="text-slate-400 hover:text-slate-600"
        >
          ×
        </button>
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={config.enabled} onChange={(e) => updateConfig({ enabled: e.target.checked })} />
        <span className="text-xs text-slate-500">Enabled</span>
      </label>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setType('text')}
          className={`${buttonBase} ${config.type === 'text' ? buttonActive : buttonInactive}`}
          aria-pressed={config.type === 'text'}
        >
          Text
        </button>
        <button
          type="button"
          onClick={() => setType('image')}
          className={`${buttonBase} ${config.type === 'image' ? buttonActive : buttonInactive}`}
          aria-pressed={config.type === 'image'}
        >
          Image
        </button>
      </div>

      {config.type === 'text' ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Text</span>
            <textarea
              value={config.text}
              onChange={(e) => updateConfig({ text: e.target.value })}
              className="rounded border border-slate-300 px-2 py-1"
              rows={2}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Font family</span>
            <select
              value={config.fontFamily}
              onChange={(e) => updateConfig({ fontFamily: e.target.value })}
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
              value={config.fontSize}
              onChange={(e) => updateConfig({ fontSize: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Colour</span>
            <input
              type="color"
              value={config.color}
              onChange={(e) => updateConfig({ color: e.target.value })}
              className="h-8 w-full rounded border border-slate-300"
            />
          </label>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Image</span>
            <input type="file" accept="image/png,image/jpeg" onChange={handleImageFile} className="text-xs" />
          </label>

          {config.dataUrl && (
            <img src={config.dataUrl} alt="Watermark preview" className="max-h-24 rounded border border-slate-300" />
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Scale</span>
            <input
              type="number"
              min={0.05}
              step={0.05}
              value={config.scale}
              onChange={(e) => updateConfig({ scale: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>
        </>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Opacity ({Math.round(config.opacity * 100)}%)</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={config.opacity}
          onChange={(e) => updateConfig({ opacity: Number(e.target.value) })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Rotation (degrees)</span>
        <input
          type="number"
          value={config.rotationDeg}
          onChange={(e) => updateConfig({ rotationDeg: Number(e.target.value) })}
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <div className="flex flex-col gap-1 border-t border-slate-200 pt-2">
        <span className="text-xs text-slate-500">Page range (of {visiblePageCount})</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={visiblePageCount}
            value={rangeFrom}
            onChange={(e) => handleRangeChange(Number(e.target.value), rangeTo)}
            className="w-16 rounded border border-slate-300 px-2 py-1"
          />
          <span className="text-xs text-slate-500">to</span>
          <input
            type="number"
            min={1}
            max={visiblePageCount}
            value={rangeTo}
            onChange={(e) => handleRangeChange(rangeFrom, Number(e.target.value))}
            className="w-16 rounded border border-slate-300 px-2 py-1"
          />
        </div>
        <button
          type="button"
          onClick={() => applyRange(rangeFrom, rangeTo)}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
        >
          Apply range
        </button>
        <span className="text-xs text-slate-400">Applies to {config.pageIndices.length} page(s)</span>
      </div>
    </div>
  )
}
