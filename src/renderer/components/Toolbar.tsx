import { selectCanRedo, selectCanUndo, useHistoryStore } from '../core/history'
import { useDocumentStore } from '../store/documentStore'
import { useUiStore, type Tool } from '../store/uiStore'

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Image' },
  { id: 'rect', label: 'Rect' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'line', label: 'Line' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'freehand', label: 'Freehand' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'whiteout', label: 'Whiteout' },
  { id: 'signature', label: 'Signature' }
]

export default function Toolbar(): JSX.Element {
  const fileName = useDocumentStore((s) => s.fileName)
  const isLoading = useDocumentStore((s) => s.isLoading)
  const isSaving = useDocumentStore((s) => s.isSaving)
  const isDirty = useDocumentStore((s) => s.isDirty)
  const error = useDocumentStore((s) => s.error)
  const openFile = useDocumentStore((s) => s.openFile)
  const save = useDocumentStore((s) => s.save)
  const saveAs = useDocumentStore((s) => s.saveAs)

  const zoom = useUiStore((s) => s.zoom)
  const fitWidth = useUiStore((s) => s.fitWidth)
  const zoomIn = useUiStore((s) => s.zoomIn)
  const zoomOut = useUiStore((s) => s.zoomOut)
  const setFitWidth = useUiStore((s) => s.setFitWidth)
  const activeTool = useUiStore((s) => s.activeTool)
  const setActiveTool = useUiStore((s) => s.setActiveTool)

  const canUndo = useHistoryStore(selectCanUndo)
  const canRedo = useHistoryStore(selectCanRedo)

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 text-sm">
      <button
        type="button"
        onClick={() => void openFile()}
        disabled={isLoading}
        className="rounded bg-slate-800 px-3 py-1.5 text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {isLoading ? 'Opening…' : 'Open'}
      </button>

      <button
        type="button"
        onClick={() => void save()}
        disabled={!fileName || isLoading || isSaving}
        className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : 'Save'}
      </button>

      <button
        type="button"
        onClick={() => void saveAs()}
        disabled={!fileName || isLoading || isSaving}
        className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        Save As
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => useHistoryStore.getState().undo()}
          disabled={!canUndo}
          className="h-7 w-7 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
          aria-label="Undo"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={() => useHistoryStore.getState().redo()}
          disabled={!canRedo}
          className="h-7 w-7 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
          aria-label="Redo"
        >
          ↷
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={zoomOut}
          className="h-7 w-7 rounded border border-slate-300 hover:bg-slate-100"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="w-12 text-center text-slate-600">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={zoomIn}
          className="h-7 w-7 rounded border border-slate-300 hover:bg-slate-100"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={() => setFitWidth(!fitWidth)}
        className={`rounded border px-2 py-1 ${
          fitWidth
            ? 'border-slate-800 bg-slate-800 text-white'
            : 'border-slate-300 text-slate-600 hover:bg-slate-100'
        }`}
      >
        Fit width
      </button>

      <div className="flex flex-wrap items-center gap-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => setActiveTool(activeTool === tool.id ? 'select' : tool.id)}
            className={`rounded border px-2 py-1 ${
              activeTool === tool.id
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
            aria-pressed={activeTool === tool.id}
          >
            {tool.label}
          </button>
        ))}
      </div>

      <span className="flex-1 truncate text-slate-500">
        {fileName ?? 'No file open'}
        {isDirty && <span className="text-slate-800"> •</span>}
      </span>

      {error && <span className="text-red-600">{error}</span>}
    </div>
  )
}
