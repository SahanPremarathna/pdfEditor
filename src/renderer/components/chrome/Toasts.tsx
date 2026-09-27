import { CircleAlert, Info, X } from 'lucide-react'
import { useEffect } from 'react'
import { useDocumentStore } from '../../store/documentStore'

const NOTICE_AUTO_DISMISS_MS = 9000

/** The document store's `error` / `notice` fields, shown as floating toasts.
 *  Notices fade on their own; errors stay until dismissed. */
export default function Toasts(): JSX.Element {
  const error = useDocumentStore((s) => s.error)
  const notice = useDocumentStore((s) => s.notice)
  const clearError = useDocumentStore((s) => s.clearError)
  const clearNotice = useDocumentStore((s) => s.clearNotice)

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(clearNotice, NOTICE_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [notice, clearNotice])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-16"
    >
      {error && (
        <div
          role="alert"
          className="glass-strong pointer-events-auto flex max-w-lg animate-pop-in items-start gap-3 rounded-2xl border-rose-500/30 py-3 pl-3.5 pr-2 text-sm"
        >
          <CircleAlert size={18} className="mt-0.5 shrink-0 text-rose-500" />
          <span className="text-slate-800 dark:text-slate-100">{error}</span>
          <button type="button" onClick={clearError} className="icon-btn h-6 w-6 rounded-lg" aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}
      {notice && (
        <div className="glass-strong pointer-events-auto flex max-w-lg animate-pop-in items-start gap-3 rounded-2xl py-3 pl-3.5 pr-2 text-sm">
          <Info size={18} className="mt-0.5 shrink-0 text-ink-500" />
          <span className="text-slate-800 dark:text-slate-100">{notice}</span>
          <button type="button" onClick={clearNotice} className="icon-btn h-6 w-6 rounded-lg" aria-label="Dismiss notice">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
