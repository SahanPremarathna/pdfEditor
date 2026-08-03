import { create } from 'zustand'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 1.2

export type Tool = 'select' | 'text'

interface UiState {
  zoom: number
  fitWidth: boolean
  activeTool: Tool
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  setFitWidth: (fitWidth: boolean) => void
  setActiveTool: (tool: Tool) => void
}

const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

export const useUiStore = create<UiState>((set, get) => ({
  zoom: 1,
  fitWidth: true,
  activeTool: 'select',

  setZoom: (zoom) => set({ zoom: clampZoom(zoom), fitWidth: false }),
  zoomIn: () => set({ zoom: clampZoom(get().zoom * ZOOM_STEP), fitWidth: false }),
  zoomOut: () => set({ zoom: clampZoom(get().zoom / ZOOM_STEP), fitWidth: false }),
  setFitWidth: (fitWidth) => set({ fitWidth }),
  setActiveTool: (tool) => set({ activeTool: tool })
}))
