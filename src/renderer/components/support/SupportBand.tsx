import { useUiStore } from '../../store/uiStore'
import KofiButton from './KofiButton'
import SupportIllustration from './SupportIllustration'

/** The welcome screen's "keep it free" band: illustration, one honest line,
 *  and the Ko-fi button. */
export default function SupportBand(): JSX.Element {
  const openModal = useUiStore((s) => s.openModal)

  return (
    <section className="glass relative w-full max-w-3xl animate-slide-up overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="bg-kofi-gradient pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl" />
      <div className="bg-accent-gradient pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full opacity-20 blur-3xl" />
      <div className="relative flex flex-col items-center gap-6 sm:flex-row">
        <SupportIllustration className="h-36 w-44 shrink-0" />
        <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Kept free by people like you</h2>
          <p className="max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            No ads, no paywall, no data harvesting. If Inkline saves you a subscription, consider buying me a coffee — it
            pays for hosting and new features.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <KofiButton />
            <button type="button" className="btn btn-ghost h-10" onClick={() => openModal('support')}>
              Other ways to help
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
