import { create } from 'zustand'
import { resolveWatermarkPageRange } from '../core/watermarkRange'
import { useHistoryStore } from '../core/history'
import { useDocumentStore } from './documentStore'
import type { ImageWatermarkConfig, TextWatermarkConfig, WatermarkConfig } from '../../shared/types'

export const DEFAULT_WATERMARK_OPACITY = 0.3
export const DEFAULT_WATERMARK_ROTATION_DEG = -30 // classic diagonal angle — just the initial default, fully adjustable

interface SharedWatermarkFields {
  enabled: boolean
  xFraction: number
  yFraction: number
  rotationDeg: number
  opacity: number
  pageIndices: number[]
  rangeInput: { from: number; to: number } | null
}

function defaultSharedFields(): SharedWatermarkFields {
  return {
    enabled: false,
    xFraction: 0.5,
    yFraction: 0.5,
    rotationDeg: DEFAULT_WATERMARK_ROTATION_DEG,
    opacity: DEFAULT_WATERMARK_OPACITY,
    pageIndices: [],
    rangeInput: null
  }
}

function defaultTextConfig(shared: SharedWatermarkFields = defaultSharedFields()): TextWatermarkConfig {
  return { ...shared, type: 'text', text: 'CONFIDENTIAL', fontFamily: 'sans', fontSize: 48, color: '#ff0000' }
}

function defaultImageConfig(shared: SharedWatermarkFields = defaultSharedFields()): ImageWatermarkConfig {
  return { ...shared, type: 'image', dataUrl: null, mime: null, naturalWidth: 0, naturalHeight: 0, scale: 1 }
}

/**
 * Hand-listed, like objectStore's PdfObjectPatch / formStore's
 * FormFieldPatch — avoids the union-collapse trap a Partial<WatermarkConfig>
 * would hit (keyof a union is the intersection of its members' keys).
 * Deliberately excludes `type` — switching type needs a fresh config (see
 * setType), since a patch merge can't remove the other branch's fields.
 */
export interface WatermarkConfigPatch {
  enabled?: boolean
  rotationDeg?: number
  opacity?: number
  text?: string
  fontFamily?: string
  fontSize?: number
  color?: string
  scale?: number
}

interface WatermarkState {
  config: WatermarkConfig
  setType: (type: 'text' | 'image') => void
  updateConfig: (patch: WatermarkConfigPatch) => void
  setImageContent: (dataUrl: string, mime: 'image/png' | 'image/jpeg', naturalWidth: number, naturalHeight: number) => void
  setPosition: (xFraction: number, yFraction: number) => void
  setRangeInput: (from: number, to: number) => void
  applyRange: (from: number, to: number) => void
  reset: () => void
}

/** Mirrors objectStore's commitObjectsByPage / documentStore's commitPages
 *  exactly: no-op (no history push) when nothing actually changed, else
 *  commit + push an undo/redo entry whose closures write straight to
 *  setState (bypassing the public actions, so replaying history can never
 *  recursively push again). */
function commitConfig(
  set: (partial: Partial<WatermarkState>) => void,
  before: WatermarkConfig,
  after: WatermarkConfig
): void {
  if (after === before) return
  set({ config: after })
  useHistoryStore.getState().push({
    undo: () => useWatermarkStore.setState({ config: before }),
    redo: () => useWatermarkStore.setState({ config: after })
  })
}

export const useWatermarkStore = create<WatermarkState>((set, get) => ({
  config: defaultTextConfig(),

  setType: (type) => {
    const before = get().config
    if (before.type === type) return
    const shared = {
      enabled: before.enabled,
      xFraction: before.xFraction,
      yFraction: before.yFraction,
      rotationDeg: before.rotationDeg,
      opacity: before.opacity,
      pageIndices: before.pageIndices,
      rangeInput: before.rangeInput
    }
    const after: WatermarkConfig = type === 'text' ? defaultTextConfig(shared) : defaultImageConfig(shared)
    commitConfig(set, before, after)
  },

  updateConfig: (patch) => {
    const before = get().config
    // The merge always preserves `type` (patch never includes it), so the
    // result is still a valid member of the original config's own union
    // branch — just not something TS can prove structurally from a widened
    // patch bag, hence the cast (same pattern as objectStore.ts).
    const after = { ...before, ...patch } as WatermarkConfig
    commitConfig(set, before, after)
  },

  setImageContent: (dataUrl, mime, naturalWidth, naturalHeight) => {
    const before = get().config
    if (before.type !== 'image') return
    const after: ImageWatermarkConfig = { ...before, dataUrl, mime, naturalWidth, naturalHeight }
    commitConfig(set, before, after)
  },

  setPosition: (xFraction, yFraction) => {
    const before = get().config
    const after = { ...before, xFraction, yFraction }
    commitConfig(set, before, after)
  },

  setRangeInput: (from, to) => set((state) => ({ config: { ...state.config, rangeInput: { from, to } } })),

  applyRange: (from, to) => {
    const before = get().config
    const visiblePages = useDocumentStore.getState().pages.filter((p) => !p.deleted)
    const resolved = resolveWatermarkPageRange(visiblePages, from, to)
    if (!resolved) return
    const after = { ...before, pageIndices: resolved.pageIndices, rangeInput: resolved.rangeInput }
    commitConfig(set, before, after)
  },

  reset: () => set({ config: defaultTextConfig() })
}))
