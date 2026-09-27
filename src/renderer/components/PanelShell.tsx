import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface PanelShellProps {
  title: string
  icon: ReactNode
  onClose?: () => void
  children: ReactNode
  footer?: ReactNode
}

/** The floating glass card every inspector panel renders inside. */
export default function PanelShell({ title, icon, onClose, children, footer }: PanelShellProps): JSX.Element {
  return (
    <aside className="glass-strong pointer-events-auto flex max-h-full w-72 animate-slide-in-right flex-col rounded-2xl max-md:w-full">
      <div className="flex items-center gap-2.5 px-4 pb-2 pt-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-500/10 text-ink-600 dark:text-ink-300">{icon}</span>
        <h2 className="flex-1 text-sm font-semibold">{title}</h2>
        {onClose && (
          <button type="button" className="icon-btn h-7 w-7" onClick={onClose} aria-label={`Close ${title}`}>
            <X size={15} />
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-1 text-sm scroll-thin">{children}</div>
      {footer && <div className="border-t border-slate-900/[0.06] p-3 dark:border-white/[0.06]">{footer}</div>}
    </aside>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  )
}

/** Number input that ignores empty / non-numeric intermediate states, so
 *  clearing the box to retype never writes NaN into the document. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}): JSX.Element {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="field-label">{label}</span>
      <span className="relative">
        <input
          type="number"
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = e.target.valueAsNumber
            if (!Number.isFinite(v)) return
            const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
            onChange(clamped)
          }}
          className={`input ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-slate-400">{suffix}</span>
        )}
      </span>
    </label>
  )
}
