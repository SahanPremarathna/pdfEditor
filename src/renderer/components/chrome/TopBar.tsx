import {
  Download,
  Heart,
  Ellipsis,
  FileDown,
  FolderOpen,
  Keyboard,
  Layers,
  Monitor,
  Moon,
  MoveHorizontal,
  Redo2,
  Save,
  Scissors,
  Stamp,
  Sun,
  Undo2,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { selectCanRedo, selectCanUndo, useHistoryStore } from '../../core/history'
import { useInstallPrompt } from '../../hooks/useAppShell'
import { useDocumentStore } from '../../store/documentStore'
import { useUiStore, type ThemePreference } from '../../store/uiStore'
import { useWatermarkStore } from '../../store/watermarkStore'
import Logo from './Logo'

const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark']
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon }
const THEME_LABEL = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' }

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

function Divider(): JSX.Element {
  return <span className="mx-1 hidden h-5 w-px bg-slate-900/10 sm:block dark:bg-white/10" />
}

function MoreMenu(): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const hasDoc = useDocumentStore((s) => s.pdfDoc !== null)
  const isDirty = useDocumentStore((s) => s.isDirty)
  const saveAs = useDocumentStore((s) => s.saveAs)
  const closeDocument = useDocumentStore((s) => s.closeDocument)
  const flattenOnExport = useUiStore((s) => s.flattenOnExport)
  const setFlattenOnExport = useUiStore((s) => s.setFlattenOnExport)
  const openModal = useUiStore((s) => s.openModal)
  const toggleWatermarkPanelOpen = useUiStore((s) => s.toggleWatermarkPanelOpen)
  const { canInstall, install } = useInstallPrompt()

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = (fn: () => void): void => {
    setOpen(false)
    fn()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`icon-btn tip tip-bottom ${open ? 'bg-slate-900/[0.06] dark:bg-white/10' : ''}`}
        data-tip="More"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Ellipsis size={18} />
      </button>
      {open && (
        <div className="glass-strong absolute right-0 top-full z-50 mt-2 w-64 animate-pop-in rounded-2xl p-1.5">
          <button type="button" className="menu-item" disabled={!hasDoc} onClick={() => run(() => void saveAs())}>
            <FileDown size={16} /> Save a copy as…
            <span className="kbd ml-auto">{MOD}⇧S</span>
          </button>
          <button type="button" className="menu-item" disabled={!hasDoc} onClick={() => run(() => openModal('extract'))}>
            <Scissors size={16} /> Extract pages…
          </button>
          {/* The top bar's own watermark button is hidden on narrow screens. */}
          <button type="button" className="menu-item md:hidden" disabled={!hasDoc} onClick={() => run(toggleWatermarkPanelOpen)}>
            <Stamp size={16} /> Watermark…
          </button>
          <label className="menu-item cursor-pointer">
            <Layers size={16} />
            <span className="flex-1">Flatten forms on save</span>
            <input
              type="checkbox"
              className="checkbox"
              checked={flattenOnExport}
              onChange={(e) => setFlattenOnExport(e.target.checked)}
            />
          </label>
          <div className="my-1 h-px bg-slate-900/10 dark:bg-white/10" />
          <button type="button" className="menu-item" onClick={() => run(() => openModal('support'))}>
            <Heart size={16} className="text-rose-500" /> Support Inkline
          </button>
          <button type="button" className="menu-item" onClick={() => run(() => openModal('shortcuts'))}>
            <Keyboard size={16} /> Keyboard shortcuts
            <span className="kbd ml-auto">?</span>
          </button>
          {canInstall && (
            <button type="button" className="menu-item" onClick={() => run(install)}>
              <Download size={16} /> Install Inkline app
            </button>
          )}
          {hasDoc && (
            <>
              <div className="my-1 h-px bg-slate-900/10 dark:bg-white/10" />
              <button
                type="button"
                className="menu-item text-rose-600 dark:text-rose-400"
                onClick={() =>
                  run(() => {
                    if (!isDirty || window.confirm('Close this document? Unsaved changes will be lost.')) closeDocument()
                  })
                }
              >
                <X size={16} /> Close document
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function TopBar(): JSX.Element {
  const fileName = useDocumentStore((s) => s.fileName)
  const hasDoc = useDocumentStore((s) => s.pdfDoc !== null)
  const isLoading = useDocumentStore((s) => s.isLoading)
  const isSaving = useDocumentStore((s) => s.isSaving)
  const isDirty = useDocumentStore((s) => s.isDirty)
  const openFile = useDocumentStore((s) => s.openFile)
  const save = useDocumentStore((s) => s.save)

  const zoom = useUiStore((s) => s.zoom)
  const fitWidth = useUiStore((s) => s.fitWidth)
  const zoomIn = useUiStore((s) => s.zoomIn)
  const zoomOut = useUiStore((s) => s.zoomOut)
  const setFitWidth = useUiStore((s) => s.setFitWidth)
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const openModal = useUiStore((s) => s.openModal)
  const isWatermarkPanelOpen = useUiStore((s) => s.isWatermarkPanelOpen)
  const toggleWatermarkPanelOpen = useUiStore((s) => s.toggleWatermarkPanelOpen)
  const watermarkEnabled = useWatermarkStore((s) => s.config.enabled)

  const canUndo = useHistoryStore(selectCanUndo)
  const canRedo = useHistoryStore(selectCanRedo)

  const ThemeIcon = THEME_ICON[theme]
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3">
      {/* Brand + document */}
      <div className="glass pointer-events-auto flex h-12 min-w-0 items-center gap-2 rounded-2xl pl-2 pr-3">
        <Logo className="h-8 w-8 shrink-0" />
        <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">Inkline</span>
        {hasDoc && (
          <>
            <Divider />
            <span className="max-w-[16ch] truncate text-sm text-slate-600 sm:max-w-[28ch] dark:text-slate-300" title={fileName ?? ''}>
              {fileName}
            </span>
            {isDirty && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-ink-500 shadow-[0_0_0_3px] shadow-ink-500/20" title="Unsaved changes" />
            )}
          </>
        )}
      </div>

      {/* Editing controls */}
      {hasDoc && (
        <div className="glass pointer-events-auto hidden h-12 items-center gap-0.5 rounded-2xl px-1.5 md:flex">
          <button
            type="button"
            className="icon-btn tip tip-bottom"
            data-tip={`Undo (${MOD}Z)`}
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => useHistoryStore.getState().undo()}
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            className="icon-btn tip tip-bottom"
            data-tip={`Redo (${MOD}⇧Z)`}
            aria-label="Redo"
            disabled={!canRedo}
            onClick={() => useHistoryStore.getState().redo()}
          >
            <Redo2 size={18} />
          </button>
          <Divider />
          <button type="button" className="icon-btn tip tip-bottom" data-tip={`Zoom out (${MOD}−)`} aria-label="Zoom out" onClick={zoomOut}>
            <ZoomOut size={18} />
          </button>
          <span className="w-12 text-center text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
            {fitWidth ? 'Fit' : `${Math.round(zoom * 100)}%`}
          </span>
          <button type="button" className="icon-btn tip tip-bottom" data-tip={`Zoom in (${MOD}+)`} aria-label="Zoom in" onClick={zoomIn}>
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            className={`icon-btn tip tip-bottom ${fitWidth ? 'icon-btn-active' : ''}`}
            data-tip={`Fit width (${MOD}0)`}
            aria-label="Fit width"
            aria-pressed={fitWidth}
            onClick={() => setFitWidth(!fitWidth)}
          >
            <MoveHorizontal size={18} />
          </button>
          <Divider />
          <button
            type="button"
            className={`icon-btn tip tip-bottom ${isWatermarkPanelOpen ? 'icon-btn-active' : ''}`}
            data-tip="Watermark"
            aria-label="Watermark"
            aria-pressed={isWatermarkPanelOpen}
            onClick={toggleWatermarkPanelOpen}
          >
            <Stamp size={18} />
            {watermarkEnabled && !isWatermarkPanelOpen && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-ink-500" />
            )}
          </button>
        </div>
      )}

      {/* File actions */}
      <div className="glass pointer-events-auto flex h-12 items-center gap-1 rounded-2xl px-1.5">
        <button
          type="button"
          onClick={() => openModal('support')}
          className="group flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300"
          aria-label="Support Inkline"
        >
          <span className="bg-kofi-gradient flex h-6 w-6 animate-heartbeat-once items-center justify-center rounded-lg text-white shadow-md shadow-rose-500/30 transition group-hover:scale-110">
            <Heart size={13} className="fill-current" />
          </span>
          <span className="hidden lg:inline">Support</span>
        </button>
        <button
          type="button"
          className="icon-btn tip tip-bottom"
          data-tip={THEME_LABEL[theme]}
          aria-label={THEME_LABEL[theme]}
          onClick={() => setTheme(nextTheme)}
        >
          <ThemeIcon size={18} />
        </button>
        <MoreMenu />
        <button
          type="button"
          className="btn btn-outline tip tip-bottom h-9 px-3"
          data-tip={`Open (${MOD}O)`}
          onClick={() => void openFile()}
          disabled={isLoading}
        >
          <FolderOpen size={16} />
          <span className="hidden sm:inline">{isLoading ? 'Opening…' : 'Open'}</span>
        </button>
        {hasDoc && (
          <button
            type="button"
            className="btn btn-primary tip tip-bottom h-9 px-3"
            data-tip={`Save (${MOD}S)`}
            onClick={() => void save()}
            disabled={isLoading || isSaving}
          >
            <Save size={16} />
            <span className="hidden sm:inline">{isSaving ? 'Saving…' : 'Save'}</span>
          </button>
        )}
      </div>
    </header>
  )
}
