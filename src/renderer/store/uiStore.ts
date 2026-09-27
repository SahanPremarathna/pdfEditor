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

export type ThemePreference = 'system' | 'light' | 'dark'
export type Modal = 'shortcuts' | 'extract' | null

const THEME_STORAGE_KEY = 'inkline:theme'

function readStoredTheme(): ThemePreference {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
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
  /** Persistent session UI preference (like fitWidth/zoom), not document
   *  state — whether the next save/save-as should flatten AcroForm fields. */
  flattenOnExport: boolean
  /** Whether the watermark side panel is open. Deliberately NOT an
   *  `activeTool` value — every Tool member is a click-the-canvas-to-create
   *  gesture that PageCanvas resets back to 'select' after one use, but the
   *  watermark is configured entirely in its panel and dragged
   *  unconditionally (like any existing object, which already ignores
   *  activeTool for dragging) — a dedicated flag matches how `selectedId`/
   *  form-field-presence already independently drive RightPanel. */
  isWatermarkPanelOpen: boolean
  /** Persisted per browser; 'system' follows prefers-color-scheme. */
  theme: ThemePreference
  /** The page (stable PageMeta.index) nearest the top of the viewport — kept
   *  up to date by PageList's scroll handler, read by the status pill. */
  currentPageId: number | null
  isPagesPanelOpen: boolean
  activeModal: Modal
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
  setFlattenOnExport: (flatten: boolean) => void
  setWatermarkPanelOpen: (open: boolean) => void
  toggleWatermarkPanelOpen: () => void
  setTheme: (theme: ThemePreference) => void
  setCurrentPageId: (pageId: number | null) => void
  setPagesPanelOpen: (open: boolean) => void
  togglePagesPanelOpen: () => void
  openModal: (modal: Exclude<Modal, null>) => void
  closeModal: () => void
}

function isWideViewport(): boolean {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 1024px)').matches
}

const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

export const useUiStore = create<UiState>((set, get) => ({
  zoom: 1,
  fitWidth: true,
  activeTool: 'select',
  lastActivePageIndex: 0,
  signatureRequest: null,
  scrollToPageId: null,
  flattenOnExport: false,
  isWatermarkPanelOpen: false,
  theme: readStoredTheme(),
  currentPageId: null,
  // Collapsed by default on narrow screens, where it overlays the page.
  isPagesPanelOpen: isWideViewport(),
  activeModal: null,

  setZoom: (zoom) => set({ zoom: clampZoom(zoom), fitWidth: false }),
  zoomIn: () => set({ zoom: clampZoom(get().zoom * ZOOM_STEP), fitWidth: false }),
  zoomOut: () => set({ zoom: clampZoom(get().zoom / ZOOM_STEP), fitWidth: false }),
  setFitWidth: (fitWidth) => set({ fitWidth }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setLastActivePageIndex: (pageIndex) => set({ lastActivePageIndex: pageIndex }),
  requestSignature: (pageIndex, x, y) => set({ signatureRequest: { pageIndex, x, y } }),
  clearSignatureRequest: () => set({ signatureRequest: null }),
  requestScrollToPage: (pageIndex) => set({ scrollToPageId: pageIndex }),
  clearScrollToPage: () => set({ scrollToPageId: null }),
  setFlattenOnExport: (flatten) => set({ flattenOnExport: flatten }),
  setWatermarkPanelOpen: (open) => set({ isWatermarkPanelOpen: open }),
  toggleWatermarkPanelOpen: () => set((s) => ({ isWatermarkPanelOpen: !s.isWatermarkPanelOpen })),
  setTheme: (theme) => {
    try {
      if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Storage blocked — the choice still applies for this session.
    }
    set({ theme })
  },
  setCurrentPageId: (pageId) => set({ currentPageId: pageId }),
  setPagesPanelOpen: (open) => set({ isPagesPanelOpen: open }),
  togglePagesPanelOpen: () => set((s) => ({ isPagesPanelOpen: !s.isPagesPanelOpen })),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null })
}))
