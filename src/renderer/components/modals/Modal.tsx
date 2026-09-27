import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  widthClass?: string
}

/** Centred glass dialog with a blurred backdrop. Escape and backdrop click close it. */
export default function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  widthClass = 'max-w-md'
}: ModalProps): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[80] flex animate-fade-in items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass-strong flex max-h-[90vh] w-full ${widthClass} animate-pop-in flex-col rounded-3xl`}
      >
        <div className="flex items-start gap-3 p-5 pb-3">
          {icon && (
            <div className="bg-accent-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg shadow-ink-600/25">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn h-8 w-8" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5 scroll-thin">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-900/[0.06] p-4 dark:border-white/[0.06]">{footer}</div>}
      </div>
    </div>
  )
}
