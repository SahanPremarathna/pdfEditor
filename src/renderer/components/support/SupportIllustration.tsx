import { useId } from 'react'

const SVG_ANIM = '[transform-box:fill-box] origin-center'

/** A gradient coffee cup with rising steam and a floating heart. Pure SVG +
 *  CSS animation (disabled under prefers-reduced-motion by styles.css). */
export default function SupportIllustration({ className = '' }: { className?: string }): JSX.Element {
  const id = useId()
  const cup = `${id}-cup`
  const heart = `${id}-heart`
  const glow = `${id}-glow`
  const coffee = `${id}-coffee`

  return (
    <svg viewBox="0 0 220 180" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={glow} cx="50%" cy="55%" r="50%">
          <stop offset="0" stopColor="#a78bfa" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#f472b6" stopOpacity="0.18" />
          <stop offset="1" stopColor="#f472b6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={cup} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b6cff" />
          <stop offset="0.55" stopColor="#6938ef" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
        <linearGradient id={coffee} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c4a2d" />
          <stop offset="1" stopColor="#4a2a18" />
        </linearGradient>
        <linearGradient id={heart} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a7a" />
          <stop offset="0.5" stopColor="#ff5e5b" />
          <stop offset="1" stopColor="#e0457b" />
        </linearGradient>
      </defs>

      <circle cx="110" cy="100" r="86" fill={`url(#${glow})`} />

      {/* sparkles */}
      {[
        { x: 38, y: 58, s: 1, d: '[animation-delay:0ms]' },
        { x: 182, y: 46, s: 0.8, d: '[animation-delay:700ms]' },
        { x: 170, y: 128, s: 0.6, d: '[animation-delay:1300ms]' },
        { x: 50, y: 136, s: 0.7, d: '[animation-delay:1800ms]' }
      ].map(({ x, y, s, d }) => (
        <path
          key={`${x}-${y}`}
          d={`M${x} ${y - 8 * s}l${2 * s} ${6 * s} ${6 * s} ${2 * s}-${6 * s} ${2 * s}-${2 * s} ${6 * s}-${2 * s}-${6 * s}-${6 * s}-${2 * s} ${6 * s}-${2 * s}z`}
          fill="#fcd34d"
          className={`animate-twinkle ${SVG_ANIM} ${d}`}
        />
      ))}

      {/* steam */}
      {[
        { x: 92, d: '[animation-delay:0ms]' },
        { x: 110, d: '[animation-delay:900ms]' },
        { x: 128, d: '[animation-delay:1800ms]' }
      ].map(({ x, d }) => (
        <path
          key={x}
          d={`M${x} 92c-6-8 6-12 0-20s6-12 0-18`}
          fill="none"
          stroke="#c4b5fd"
          strokeWidth="4"
          strokeLinecap="round"
          className={`animate-steam opacity-0 ${SVG_ANIM} ${d}`}
        />
      ))}

      {/* heart */}
      <g className={`animate-heart-float ${SVG_ANIM}`}>
        <path
          d="M110 50c-5-9-20-9-20 3 0 9 12 16 20 22 8-6 20-13 20-22 0-12-15-12-20-3z"
          fill={`url(#${heart})`}
        />
        <path d="M97 51c1-3 5-4 7-2" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>

      {/* saucer */}
      <ellipse cx="110" cy="156" rx="62" ry="9" fill="#1e1b4b" opacity="0.12" />
      <ellipse cx="110" cy="152" rx="56" ry="8" fill={`url(#${cup})`} opacity="0.55" />

      {/* cup */}
      <path d="M150 108h8a14 14 0 0 1 0 28h-10" fill="none" stroke={`url(#${cup})`} strokeWidth="8" strokeLinecap="round" />
      <path d="M68 100h84l-8 40a14 14 0 0 1-14 11H90a14 14 0 0 1-14-11z" fill={`url(#${cup})`} />
      <ellipse cx="110" cy="100" rx="42" ry="8" fill={`url(#${coffee})`} />
      <path d="M80 112c2 10 4 20 8 28" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* tiny heart on the cup */}
      <path d="M110 118c-2-4-9-4-9 1 0 4 5 7 9 10 4-3 9-6 9-10 0-5-7-5-9-1z" fill="#ffffff" fillOpacity="0.9" />
    </svg>
  )
}
