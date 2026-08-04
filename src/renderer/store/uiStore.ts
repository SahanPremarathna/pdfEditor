import { create } from 'zustand'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 1.2

export type Tool =
  | 'select'
  | 'text'
  | 'image'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'highlight'
  | 'whiteout'
  | 'signature'

/** Captured when the armed signature tool is clicked on a specific page —
 *  the target page/position for the PathObject the pad modal will create.
 *  x/y are in PDF points, top-left origin, same convention as everywhere. */
export interface SignatureRequest {
  pageIndex: number
  x: number
  y: number
}

interface UiState {
  zoom: number
  fitWidth: boolean
  activeTool: Tool
  /** The page a mousedown last happened on. Paste has no click position to
   *  derive a target page from, so it falls back to this. */
  lastActivePageIndex: number
  signatureRequest: SignatureRequest | null
  /** A one-shot "scroll the main viewport to this page" signal (e.g. from
   *  clicking a thumbnail) — PageList consumes it and clears it back to null
   *  right after scrolling, so it never fires again on its own. */
  scrollToPageId: number | null
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  setFitWidth: (fitWidth: boolean) => void
  setActiveTool: (tool: Tool) => void
  setLastActivePageIndex: (pageIndex: number) => void
  requestSignature: (pageIndex: number, x: number, y: number) => void
  clearSignatureRequest: () => void
  requestScrollToPage: (pageIndex: number) => void
  clearScrollToPage: () => void
}

const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

export const useUiStore = create<UiState>((set, get) => ({
  zoom: 1,
  fitWidth: true,
  activeTool: 'select',
  lastActivePageIndex: 0,
  signatureRequest: null,
  scrollToPageId: null,

  setZoom: (zoom) => set({ zoom: clampZoom(zoom), fitWidth: false }),
  zoomIn: () => set({ zoom: clampZoom(get().zoom * ZOOM_STEP), fitWidth: false }),
  zoomOut: () => set({ zoom: clampZoom(get().zoom / ZOOM_STEP), fitWidth: false }),
  setFitWidth: (fitWidth) => set({ fitWidth }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setLastActivePageIndex: (pageIndex) => set({ lastActivePageIndex: pageIndex }),
  requestSignature: (pageIndex, x, y) => set({ signatureRequest: { pageIndex, x, y } }),
  clearSignatureRequest: () => set({ signatureRequest: null }),
  requestScrollToPage: (pageIndex) => set({ scrollToPageId: pageIndex }),
  clearScrollToPage: () => set({ scrollToPageId: null })
}))
