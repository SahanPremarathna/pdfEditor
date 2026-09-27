import { useId } from 'react'

/** The TrueFreePDF mark: a fountain-pen nib leaving an ink stroke. Kept in sync
 *  with public/favicon.svg (which the PWA icons are rendered from). */
export default function Logo({ className = '' }: { className?: string }): JSX.Element {
  const id = useId()
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b6cff" />
          <stop offset="0.55" stopColor="#6938ef" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill={`url(#${id}-bg)`} />
      <path d="M14 50c6-5 11-5 15-1.5" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="3.2" strokeLinecap="round" />
      <g transform="rotate(35 36 30)">
        <rect x="29" y="9" width="14" height="6" rx="2" fill="#ffffff" fillOpacity="0.85" />
        <path d="M29 17h14l4.2 10.5c.6 1.5.4 3.2-.5 4.5L36 48 25.3 32c-.9-1.3-1.1-3-.5-4.5Z" fill="#ffffff" />
        <path d="M36 48V34.5" stroke="#6938ef" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="36" cy="31" r="3" fill="#6938ef" />
      </g>
    </svg>
  )
}
