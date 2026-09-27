import { Check, Coffee, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { KOFI_URL } from '../../config/support'
import { rememberSupport, shareApp } from './supportActions'

/** Confetti pieces: fixed trajectories as static classes (no inline styles). */
const CONFETTI = [
  'bg-rose-400 [--dx:-54px] [--dy:-46px] [--rot:-120deg]',
  'bg-amber-300 [--dx:-26px] [--dy:-64px] [--rot:90deg]',
  'bg-ink-400 [--dx:6px] [--dy:-70px] [--rot:200deg]',
  'bg-fuchsia-400 [--dx:34px] [--dy:-60px] [--rot:-80deg]',
  'bg-sky-300 [--dx:58px] [--dy:-40px] [--rot:140deg]',
  'bg-emerald-300 [--dx:-44px] [--dy:-18px] [--rot:60deg]',
  'bg-rose-300 [--dx:48px] [--dy:-14px] [--rot:-160deg]',
  'bg-amber-400 [--dx:-8px] [--dy:-52px] [--rot:30deg]'
]

interface KofiButtonProps {
  size?: 'md' | 'lg'
  label?: string
  className?: string
  onSupport?: () => void
}

/**
 * "Support on Ko-fi" — an outgoing link in a new tab, with a small confetti
 * burst. Without a configured Ko-fi URL it becomes a "Share TrueFreePDF" button,
 * which is still a real way to help.
 */
export default function KofiButton({ size = 'md', label = 'Support on Ko-fi', className = '', onSupport }: KofiButtonProps): JSX.Element {
  const [burst, setBurst] = useState(0)
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')

  useEffect(() => {
    if (burst === 0) return undefined
    const t = window.setTimeout(() => setBurst(0), 1000)
    return () => window.clearTimeout(t)
  }, [burst])

  useEffect(() => {
    if (shareState === 'idle') return undefined
    const t = window.setTimeout(() => setShareState('idle'), 2200)
    return () => window.clearTimeout(t)
  }, [shareState])

  const sizing = size === 'lg' ? 'h-12 px-6 text-[15px] rounded-2xl' : 'h-10 px-4 text-sm rounded-xl'
  const base = `relative inline-flex items-center justify-center gap-2 font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${sizing} ${className}`

  if (!KOFI_URL) {
    return (
      <button
        type="button"
        className={`bg-accent-gradient ${base}`}
        onClick={() =>
          void shareApp().then((outcome) => {
            if (outcome === 'copied') setShareState('copied')
          })
        }
      >
        {shareState === 'copied' ? <Check size={18} /> : <Share2 size={18} />}
        {shareState === 'copied' ? 'Link copied!' : 'Share TrueFreePDF'}
      </button>
    )
  }

  return (
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`bg-kofi-gradient ${base}`}
      onClick={() => {
        rememberSupport()
        setBurst((b) => b + 1)
        onSupport?.()
      }}
    >
      <Coffee size={size === 'lg' ? 20 : 18} strokeWidth={2.2} />
      {label}
      {burst > 0 && (
        <span key={burst} aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {CONFETTI.map((c) => (
            <span key={c} className={`absolute h-2 w-1.5 animate-confetti rounded-[2px] ${c}`} />
          ))}
        </span>
      )}
    </a>
  )
}
