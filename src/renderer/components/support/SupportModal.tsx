import { Check, Heart, Rocket, Server, Share2, ShieldCheck, Star, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MAKER_NAME, REPO_URL } from '../../config/support'
import { useUiStore } from '../../store/uiStore'
import KofiButton from './KofiButton'
import SupportIllustration from './SupportIllustration'
import { rememberSupport, shareInkline } from './supportActions'

const PAYS_FOR = [
  { icon: Server, title: 'Hosting', body: 'Domain, bandwidth and keeping it fast.' },
  { icon: Rocket, title: 'New features', body: 'Time to build what you ask for.' },
  { icon: ShieldCheck, title: 'Staying free', body: 'No ads, no paywall, no tracking.' }
]

function SupportDialog(): JSX.Element {
  const closeModal = useUiStore((s) => s.closeModal)
  const [shared, setShared] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [thanked, setThanked] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeModal()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [closeModal])

  return (
    <div
      className="fixed inset-0 z-[80] flex animate-fade-in items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Support Inkline"
        className="glass-strong relative flex max-h-[92vh] w-full max-w-lg animate-pop-in flex-col overflow-hidden rounded-[28px]"
      >
        <div className="bg-accent-gradient pointer-events-none absolute -top-32 left-1/2 h-64 w-[130%] -translate-x-1/2 rounded-full opacity-20 blur-3xl" />
        <button type="button" onClick={closeModal} className="icon-btn absolute right-3 top-3 z-10 h-8 w-8" aria-label="Close">
          <X size={16} />
        </button>

        <div className="relative overflow-y-auto px-6 pb-6 pt-4 scroll-thin sm:px-8">
          <SupportIllustration className="mx-auto h-40 w-48" />

          <h2 className="mt-1 text-center text-2xl font-bold tracking-tight">
            Inkline is free. <span className="text-gradient">Really free.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {MAKER_NAME ? `Hi, I'm ${MAKER_NAME}. ` : 'Hi! '}I build Inkline on my own. There's no paywall at export, no watermark, no
            sign-up and nothing is uploaded — and it'll stay that way. If it saved you time or money, a coffee helps keep it
            running for everyone.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {PAYS_FOR.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl bg-slate-900/[0.035] p-3 text-center dark:bg-white/[0.05]">
                <Icon size={18} className="mx-auto text-ink-500 dark:text-ink-300" />
                <div className="mt-1.5 text-xs font-semibold">{title}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{body}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <KofiButton size="lg" className="w-full sm:w-auto" onSupport={() => setThanked(true)} />
          </div>
          {thanked && (
            <p className="mt-3 flex animate-fade-in items-center justify-center gap-1.5 text-sm font-medium text-rose-500">
              <Heart size={14} className="fill-current" /> Thank you — it genuinely means a lot.
            </p>
          )}

          <div className="mt-6 border-t border-slate-900/[0.06] pt-4 dark:border-white/[0.06]">
            <p className="field-label mb-2.5 text-center">Free ways to help</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn btn-outline h-9"
                onClick={() => void shareInkline().then((o) => setShared(o === 'failed' ? 'failed' : 'copied'))}
              >
                {shared === 'copied' ? <Check size={15} className="text-emerald-500" /> : <Share2 size={15} />}
                {shared === 'copied' ? 'Link copied!' : shared === 'failed' ? "Couldn't copy" : 'Share Inkline'}
              </button>
              {REPO_URL && (
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline h-9">
                  <Star size={15} /> Star on GitHub
                </a>
              )}
              <button
                type="button"
                className="btn btn-ghost h-9 text-slate-500"
                onClick={() => {
                  rememberSupport()
                  setThanked(true)
                }}
              >
                <Heart size={15} /> I've already supported
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SupportModal(): JSX.Element | null {
  const activeModal = useUiStore((s) => s.activeModal)
  return activeModal === 'support' ? <SupportDialog /> : null
}
