import { ChevronDown, ChevronUp, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { selectCanRedo, selectCanUndo, useHistoryStore } from '../../core/history'
import { useDocumentStore } from '../../store/documentStore'
import { useUiStore } from '../../store/uiStore'

/** Bottom-centre pill: current page with prev/next, plus undo/redo and zoom
 *  on narrow screens (where the top bar hides them). */
export default function StatusPill(): JSX.Element | null {
  const pages = useDocumentStore((s) => s.pages)
  const currentPageId = useUiStore((s) => s.currentPageId)
  const requestScrollToPage = useUiStore((s) => s.requestScrollToPage)
  const setLastActivePageIndex = useUiStore((s) => s.setLastActivePageIndex)
  const zoomIn = useUiStore((s) => s.zoomIn)
  const zoomOut = useUiStore((s) => s.zoomOut)
  const canUndo = useHistoryStore(selectCanUndo)
  const canRedo = useHistoryStore(selectCanRedo)

  const visible = pages.filter((p) => !p.deleted)
  if (visible.length === 0) return null

  const currentIdx = Math.max(0, visible.findIndex((p) => p.index === currentPageId))
  const goTo = (idx: number): void => {
    const target = visible[Math.min(visible.length - 1, Math.max(0, idx))]
    setLastActivePageIndex(target.index)
    requestScrollToPage(target.index)
  }

  return (
    <div className="glass pointer-events-auto flex h-10 animate-slide-up items-center gap-0.5 rounded-full px-1.5 text-xs font-medium">
      <button type="button" className="icon-btn h-7 w-7 rounded-full md:hidden" aria-label="Undo" disabled={!canUndo} onClick={() => useHistoryStore.getState().undo()}>
        <Undo2 size={15} />
      </button>
      <button type="button" className="icon-btn h-7 w-7 rounded-full md:hidden" aria-label="Redo" disabled={!canRedo} onClick={() => useHistoryStore.getState().redo()}>
        <Redo2 size={15} />
      </button>
      <span className="mx-0.5 h-4 w-px bg-slate-900/10 md:hidden dark:bg-white/10" />
      <button type="button" className="icon-btn h-7 w-7 rounded-full" aria-label="Previous page" disabled={currentIdx === 0} onClick={() => goTo(currentIdx - 1)}>
        <ChevronUp size={16} />
      </button>
      <span className="min-w-16 text-center tabular-nums text-slate-700 dark:text-slate-200">
        {currentIdx + 1} <span className="text-slate-400">/ {visible.length}</span>
      </span>
      <button
        type="button"
        className="icon-btn h-7 w-7 rounded-full"
        aria-label="Next page"
        disabled={currentIdx >= visible.length - 1}
        onClick={() => goTo(currentIdx + 1)}
      >
        <ChevronDown size={16} />
      </button>
      <span className="mx-0.5 h-4 w-px bg-slate-900/10 md:hidden dark:bg-white/10" />
      <button type="button" className="icon-btn h-7 w-7 rounded-full md:hidden" aria-label="Zoom out" onClick={zoomOut}>
        <ZoomOut size={15} />
      </button>
      <button type="button" className="icon-btn h-7 w-7 rounded-full md:hidden" aria-label="Zoom in" onClick={zoomIn}>
        <ZoomIn size={15} />
      </button>
    </div>
  )
}
