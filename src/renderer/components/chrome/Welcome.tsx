import {
  Check,
  Clock,
  Coffee,
  Heart,
  FileText,
  FileUp,
  FormInput,
  Highlighter,
  LayoutGrid,
  ShieldCheck,
  Signature,
  Stamp,
  Type,
  WifiOff,
  X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { getRecentEntries, platform, type RecentEntry } from '../../platform'
import { KOFI_URL, MAKER_NAME } from '../../config/support'
import { useDocumentStore } from '../../store/documentStore'
import { useUiStore } from '../../store/uiStore'
import FreeForeverSection from '../support/FreeForeverSection'
import SupportBand from '../support/SupportBand'
import { rememberSupport } from '../support/supportActions'

const PROMISES = ['100% free', 'No sign-up', 'No watermark', 'No uploads']

/** Staggered entrance for the feature cards (static classes, one per card). */
const STAGGER = [
  '[animation-delay:120ms]',
  '[animation-delay:180ms]',
  '[animation-delay:240ms]',
  '[animation-delay:300ms]',
  '[animation-delay:360ms]',
  '[animation-delay:420ms]'
]

const FEATURES = [
  { icon: Type, title: 'Add text', body: 'Type anywhere - any language, any symbol.' },
  { icon: Signature, title: 'Sign', body: 'Draw a vector signature and drop it in.' },
  { icon: Highlighter, title: 'Mark up', body: 'Highlight, draw, shapes, arrows, whiteout.' },
  { icon: FormInput, title: 'Fill forms', body: 'Fill AcroForm fields, optionally flatten.' },
  { icon: LayoutGrid, title: 'Organise pages', body: 'Reorder, rotate, insert, merge, extract.' },
  { icon: Stamp, title: 'Watermark', body: 'Text or image, across any page range.' }
]

function formatSize(bytes: number | null): string {
  if (bytes === null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(ms: number | null): string {
  if (ms === null) return ''
  const diff = Date.now() - ms
  const minute = 60_000
  if (diff < minute) return 'just now'
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} min ago`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} h ago`
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function RecentFiles(): JSX.Element | null {
  const openPath = useDocumentStore((s) => s.openPath)
  const [recents, setRecents] = useState<RecentEntry[]>([])

  useEffect(() => {
    let alive = true
    void getRecentEntries().then((entries) => {
      if (alive) setRecents(entries)
    })
    return () => {
      alive = false
    }
  }, [])

  if (recents.length === 0) return null

  const remove = (key: string): void => {
    setRecents((r) => r.filter((e) => e.key !== key))
    void platform().removeRecent?.(key)
  }

  return (
    <section className="w-full max-w-xl animate-slide-up">
      <h2 className="field-label mb-2 flex items-center gap-1.5 px-1">
        <Clock size={12} /> Recent
      </h2>
      <ul className="glass flex flex-col gap-0.5 rounded-2xl p-1.5">
        {recents.map((entry) => (
          <li key={entry.key} className="group flex items-center">
            <button
              type="button"
              onClick={() => void openPath(entry.key)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.07]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                <FileText size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{entry.name}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {[formatSize(entry.size), formatWhen(entry.openedAt)].filter(Boolean).join(' · ') || entry.key}
                </span>
              </span>
            </button>
            {platform().removeRecent && (
              <button
                type="button"
                onClick={() => remove(entry.key)}
                className="icon-btn mr-1 h-7 w-7 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Remove ${entry.name} from recent files`}
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Landing screen when no document is open (also the loading/error state). */
export default function Welcome(): JSX.Element {
  const isLoading = useDocumentStore((s) => s.isLoading)
  const openFile = useDocumentStore((s) => s.openFile)
  const [isOver, setIsOver] = useState(false)
  const openModal = useUiStore((s) => s.openModal)

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-ink-500/20 border-t-ink-500" />
        </div>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Opening your document…</span>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-y-auto scroll-thin">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col items-center gap-10 px-5 pb-16 pt-28 md:pt-32">
        <div className="flex animate-slide-up flex-col items-center gap-5 text-center">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <ShieldCheck size={14} className="text-emerald-500" /> Private by design - your files never leave this device
          </span>
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Edit PDFs <span className="text-gradient">Beautifully.</span>
          </h1>
          <p className="max-w-xl text-base text-slate-600 sm:text-lg dark:text-slate-300">
            Add text, sign, highlight, fill forms, watermark and rearrange pages - right in your browser, even offline.
          </p>
          <ul className="flex flex-wrap justify-center gap-2" aria-label="Always included">
            {PROMISES.map((promise) => (
              <li
                key={promise}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
              >
                <Check size={13} strokeWidth={3} /> {promise}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => void openFile()}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault()
              setIsOver(true)
            }
          }}
          onDragLeave={() => setIsOver(false)}
          onDrop={() => setIsOver(false)}
          className={`glass group relative flex w-full max-w-xl animate-pop-in flex-col items-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed px-6 py-12 transition
            ${isOver ? 'scale-[1.02] border-ink-500' : 'border-ink-400/30 hover:border-ink-400/70'}`}
        >
          <div className="bg-accent-gradient absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full opacity-20 blur-3xl transition group-hover:opacity-35" />
          <div className="bg-accent-gradient relative flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl shadow-ink-600/30 transition group-hover:-translate-y-1">
            <FileUp size={30} />
          </div>
          <div className="relative flex flex-col gap-1">
            <span className="text-lg font-semibold">Open a PDF</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">Click to browse, or drop a file anywhere</span>
          </div>
        </button>

        {KOFI_URL ? (
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={rememberSupport}
            className="glass group -mt-4 inline-flex animate-pop-in items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:shadow-lg dark:text-slate-200"
          >
            <span className="bg-kofi-gradient flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md shadow-rose-500/30 transition group-hover:rotate-[-8deg] group-hover:scale-110">
              <Coffee size={15} strokeWidth={2.3} />
            </span>
            Love TrueFreePDF? <span className="font-semibold text-rose-600 dark:text-rose-300">Buy me a coffee</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={() => openModal('support')}
            className="glass -mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-300"
          >
            <Heart size={14} className="fill-current" /> Support TrueFreePDF
          </button>
        )}

        <RecentFiles />

        <FreeForeverSection />
        <SupportBand />

        <section className="grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className={`glass animate-slide-up rounded-2xl p-4 ${STAGGER[i] ?? ''}`}
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-ink-500/10 text-ink-600 dark:text-ink-300">
                <Icon size={18} />
              </div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{body}</p>
            </div>
          ))}
        </section>

        <footer className="flex flex-col items-center gap-2 text-center text-xs text-slate-500 dark:text-slate-400">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1">
              Made with <Heart size={12} className="fill-rose-500 text-rose-500" /> {MAKER_NAME ? `by ${MAKER_NAME}` : 'for everyone'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Free forever</span>
            <span aria-hidden="true">·</span>
            <button type="button" className="font-medium text-rose-600 hover:underline dark:text-rose-300" onClick={() => openModal('support')}>
              Support TrueFreePDF
            </button>
          </p>
          <p className="flex items-center gap-1.5">
            <WifiOff size={12} /> Works offline once loaded · Your files never leave this device
          </p>
        </footer>
      </div>
    </div>
  )
}
