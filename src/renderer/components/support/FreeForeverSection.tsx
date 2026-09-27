import { Check, Sparkles, X } from 'lucide-react'

const ROWS = [
  'Export your PDF without paying',
  'No watermark stamped on your file',
  'No account or email required',
  'Files stay on your device',
  'No daily limits or file caps',
  'Works offline'
]

/** "Free on the surface? Not here." — Inkline against the typical
 *  free-until-you-export PDF site. Deliberately names no competitor. */
export default function FreeForeverSection(): JSX.Element {
  return (
    <section className="w-full max-w-3xl animate-slide-up" aria-labelledby="free-forever-heading">
      <div className="mb-5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <Sparkles size={13} /> Free forever
        </span>
        <h2 id="free-forever-heading" className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Free on the surface? <span className="text-gradient">Not here.</span>
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-300">
          Lots of "free" PDF editors let you do all the work, then ask for money at the download button. Inkline never will.
        </p>
      </div>

      <div className="glass overflow-hidden rounded-3xl">
        <div className="grid grid-cols-[1fr_auto_auto] items-stretch text-sm">
          {/* header */}
          <div className="px-4 py-3 sm:px-5" />
          <div className="flex items-end justify-center px-3 pb-3 pt-4 text-center text-xs font-medium text-slate-500 sm:w-36 dark:text-slate-400">
            Typical “free”
            <br className="sm:hidden" /> PDF sites
          </div>
          <div className="relative flex items-end justify-center px-3 pb-3 pt-4 sm:w-36">
            <div className="bg-accent-gradient absolute inset-x-1.5 top-1.5 bottom-0 rounded-t-2xl opacity-[0.14]" />
            <span className="relative text-sm font-bold text-ink-700 dark:text-ink-200">Inkline</span>
          </div>

          {ROWS.map((row, i) => {
            const last = i === ROWS.length - 1
            return (
              <div key={row} className="contents">
                <div className="flex items-center border-t border-slate-900/[0.06] px-4 py-3 font-medium sm:px-5 dark:border-white/[0.06]">
                  {row}
                </div>
                <div className="flex items-center justify-center border-t border-slate-900/[0.06] px-3 py-3 dark:border-white/[0.06]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/10 text-rose-500/80">
                    <X size={14} strokeWidth={2.6} />
                  </span>
                </div>
                <div className="relative flex items-center justify-center border-t border-slate-900/[0.06] px-3 py-3 dark:border-white/[0.06]">
                  <div className={`bg-accent-gradient absolute inset-x-1.5 top-0 opacity-[0.14] ${last ? 'bottom-1.5 rounded-b-2xl' : 'bottom-0'}`} />
                  <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                    <Check size={14} strokeWidth={3} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
