import { Fragment } from 'react'
import { useUiStore } from '../../store/uiStore'
import { TOOL_GROUPS } from './tools'

/** Floating vertical tool palette (a horizontal strip along the bottom on
 *  phones). Clicking the armed tool again disarms it back to Select. */
export default function ToolDock(): JSX.Element {
  const activeTool = useUiStore((s) => s.activeTool)
  const setActiveTool = useUiStore((s) => s.setActiveTool)

  return (
    <nav
      aria-label="Tools"
      className="glass pointer-events-auto flex animate-slide-in-left items-center gap-0.5 rounded-2xl p-1.5 scroll-thin max-md:overflow-x-auto
        max-md:fixed max-md:inset-x-3 max-md:bottom-3 max-md:z-30 max-md:justify-between
        md:flex-col"
    >
      {TOOL_GROUPS.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <span className="h-5 w-px shrink-0 bg-slate-900/10 md:my-1 md:h-px md:w-6 dark:bg-white/10" />}
          {group.map((tool) => {
            const Icon = tool.icon
            const active = activeTool === tool.id
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTool(active && tool.id !== 'select' ? 'select' : tool.id)}
                className={`icon-btn tip tip-top md:tip-right h-10 w-10 ${active ? 'icon-btn-active' : ''}`}
                data-tip={`${tool.label}  ·  ${tool.key.toUpperCase()}${tool.hint ? `  —  ${tool.hint}` : ''}`}
                aria-label={tool.label}
                aria-pressed={active}
              >
                <Icon size={19} strokeWidth={active ? 2.2 : 1.9} />
              </button>
            )
          })}
        </Fragment>
      ))}
    </nav>
  )
}
