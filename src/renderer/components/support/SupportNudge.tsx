import { Heart, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { markDismissedForever, markShown, recordExport, shouldShowNudge } from '../../core/supportNudge'
import { useDocumentStore } from '../../store/documentStore'
import { useUiStore } from '../../store/uiStore'
import KofiButton from './KofiButton'
import { loadNudgeState, saveNudgeState } from './supportActions'

const AUTO_HIDE_MS = 20_000

/**
 * A small thank-you card that can appear AFTER a successful export — never
 * before or during one, and never blocking anything. Frequency rules live in
 * core/supportNudge.ts (2nd export onward, at most weekly, quiet after
 * supporting, off for good on "Don't show again").
 */
export default function SupportNudge(): JSX.Element | null {
  const completedExports = useDocumentStore((s) => s.completedExports)
  const activeTool = useUiStore((s) => s.activeTool)
  const [visible, setVisible] = useState(false)
  const seen = useRef(completedExports)

  useEffect(() => {
    if (completedExports <= seen.current) return
    seen.current = completedExports
    const now = Date.now()
    const state = recordExport(loadNudgeState())
    if (shouldShowNudge(state, now)) {
      saveNudgeState(markShown(state, now))
      setVisible(true)
    } else {
      saveNudgeState(state)
    }
  }, [completedExports])

  useEffect(() => {
    if (!visible) return undefined
    const t = window.setTimeout(() => setVisible(false), AUTO_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [visible])

  // Out of the way while the user is actively drawing or placing something.
  if (!visible || activeTool !== 'select') return null

  return (
    <aside
      aria-label="Support Inkline"
      className="glass-strong fixed bottom-16 right-3 z-40 w-[min(360px,calc(100vw-24px))] animate-slide-up overflow-hidden rounded-3xl p-4 max-md:bottom-[124px]"
    >
      <div className="bg-kofi-gradient pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl" />
      <button type="button" onClick={() => setVisible(false)} className="icon-btn absolute right-2 top-2 h-7 w-7" aria-label="Close">
        <X size={14} />
      </button>
      <div className="relative flex gap-3">
        <div className="bg-kofi-gradient flex h-10 w-10 shrink-0 animate-heart-float items-center justify-center rounded-2xl text-white shadow-lg shadow-rose-500/30">
          <Heart size={18} className="fill-current" />
        </div>
        <div className="min-w-0 pr-5">
          <p className="text-sm font-semibold">Saved — free, as always.</p>
          <p className="mt-0.5 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
            If Inkline saved you time, a coffee helps keep it free for everyone.
          </p>
        </div>
      </div>
      <div className="relative mt-3 flex flex-wrap items-center gap-2">
        <KofiButton label="Buy me a coffee" onSupport={() => setVisible(false)} />
        <button type="button" className="btn btn-ghost h-10 px-3 text-slate-500" onClick={() => setVisible(false)}>
          Maybe later
        </button>
        <button
          type="button"
          className="ml-auto text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline dark:hover:text-slate-200"
          onClick={() => {
            saveNudgeState(markDismissedForever(loadNudgeState()))
            setVisible(false)
          }}
        >
          Don't show again
        </button>
      </div>
    </aside>
  )
}
