import { ImageIcon, Stamp, Type } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { FONT_FAMILY_LABELS, ON_SCREEN_FONT_FAMILIES } from '../core/fontFamilies'
import { readImageFile } from '../core/imageFiles'
import { useDocumentStore } from '../store/documentStore'
import { useUiStore } from '../store/uiStore'
import { useWatermarkStore } from '../store/watermarkStore'
import type { OnScreenFontFamily } from '../core/fontFamilies'
import PanelShell, { Field, NumberField } from './PanelShell'

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
    <PanelShell title="Watermark" icon={<Stamp size={15} />} onClose={() => setWatermarkPanelOpen(false)}>
      <label className="flex items-center justify-between rounded-xl bg-slate-900/[0.03] px-3 py-2.5 dark:bg-white/[0.04]">
        <span className="text-sm font-medium">Show watermark</span>
        <input
          type="checkbox"
          className="checkbox"
          checked={config.enabled}
          onChange={(e) => updateConfig({ enabled: e.target.checked })}
        />
      </label>

      <div className="segmented">
        <button
          type="button"
          onClick={() => setType('text')}
          className={`segmented-item ${config.type === 'text' ? 'segmented-item-active' : ''}`}
          aria-pressed={config.type === 'text'}
        >
          <Type size={14} /> Text
        </button>
        <button
          type="button"
          onClick={() => setType('image')}
          className={`segmented-item ${config.type === 'image' ? 'segmented-item-active' : ''}`}
          aria-pressed={config.type === 'image'}
        >
          <ImageIcon size={14} /> Image
        </button>
      </div>

      {config.type === 'text' ? (
        <>
          <Field label="Text">
            <textarea
              value={config.text}
              onChange={(e) => updateConfig({ text: e.target.value })}
              className="input textarea"
              rows={2}
            />
          </Field>

          <Field label="Font">
            <select value={config.fontFamily} onChange={(e) => updateConfig({ fontFamily: e.target.value })} className="input">
              {ON_SCREEN_FONT_FAMILIES.map((family: OnScreenFontFamily) => (
                <option key={family} value={family}>
                  {FONT_FAMILY_LABELS[family]}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Size" value={config.fontSize} min={1} max={500} suffix="pt" onChange={(v) => updateConfig({ fontSize: v })} />
            <Field label="Colour">
              <input type="color" value={config.color} onChange={(e) => updateConfig({ color: e.target.value })} className="color-input" />
            </Field>
          </div>
        </>
      ) : (
        <>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-slate-900/15 p-3 text-center text-xs text-slate-500 transition hover:border-ink-400 dark:border-white/15">
            {config.dataUrl ? (
              <img src={config.dataUrl} alt="Watermark preview" className="max-h-24 rounded-lg" />
            ) : (
              <ImageIcon size={22} className="text-slate-400" />
            )}
            <span>{config.dataUrl ? 'Replace image' : 'Choose a PNG or JPEG'}</span>
            <input type="file" accept="image/png,image/jpeg" onChange={handleImageFile} className="hidden" />
          </label>

          <NumberField label="Scale" value={config.scale} min={0.05} max={20} step={0.05} suffix="×" onChange={(v) => updateConfig({ scale: v })} />
        </>
      )}

      <Field label={`Opacity · ${Math.round(config.opacity * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={config.opacity}
          onChange={(e) => updateConfig({ opacity: Number(e.target.value) })}
          className="range"
        />
      </Field>

      <NumberField
        label="Rotation"
        value={config.rotationDeg}
        min={-360}
        max={360}
        suffix="°"
        onChange={(v) => updateConfig({ rotationDeg: v })}
      />

      <div className="flex flex-col gap-2 border-t border-slate-900/[0.06] pt-3 dark:border-white/[0.06]">
        <span className="field-label">Pages (of {visiblePageCount})</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={visiblePageCount}
            value={rangeFrom}
            onChange={(e) => handleRangeChange(Number(e.target.value), rangeTo)}
            className="input"
            aria-label="From page"
          />
          <span className="text-xs text-slate-500">to</span>
          <input
            type="number"
            min={1}
            max={visiblePageCount}
            value={rangeTo}
            onChange={(e) => handleRangeChange(rangeFrom, Number(e.target.value))}
            className="input"
            aria-label="To page"
          />
        </div>
        <button type="button" onClick={() => applyRange(rangeFrom, rangeTo)} className="btn btn-outline w-full">
          Apply to pages {rangeFrom}–{rangeTo}
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Currently on {config.pageIndices.length} page{config.pageIndices.length === 1 ? '' : 's'} · drag it on the page to move it
        </span>
      </div>
    </PanelShell>
  )
}
