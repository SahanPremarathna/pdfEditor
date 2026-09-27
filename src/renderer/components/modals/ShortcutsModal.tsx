import { Keyboard } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { ALL_TOOLS } from '../chrome/tools'
import Modal from './Modal'

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

const GENERAL: [string, string[]][] = [
  ['Open', [MOD, 'O']],
  ['Save', [MOD, 'S']],
  ['Save as', [MOD, '⇧', 'S']],
  ['Undo', [MOD, 'Z']],
  ['Redo', [MOD, '⇧', 'Z']],
  ['Zoom in / out', [MOD, '+ / −']],
  ['Fit width', [MOD, '0']],
  ['Zoom with wheel', [MOD, 'scroll']],
  ['Duplicate object', [MOD, 'D']],
  ['Nudge object', ['←↑→↓']],
  ['Nudge ×10', ['⇧', '←↑→↓']],
  ['Delete object', ['Del']],
  ['Cancel / deselect', ['Esc']],
  ['Paste image', [MOD, 'V']],
  ['This sheet', ['?']]
]

function Keys({ keys }: { keys: string[] }): JSX.Element {
  return (
    <span className="flex gap-1">
      {keys.map((k) => (
        <kbd key={k} className="kbd">
          {k}
        </kbd>
      ))}
    </span>
  )
}

export default function ShortcutsModal(): JSX.Element | null {
  const activeModal = useUiStore((s) => s.activeModal)
  const closeModal = useUiStore((s) => s.closeModal)
  if (activeModal !== 'shortcuts') return null

  return (
    <Modal title="Keyboard shortcuts" icon={<Keyboard size={18} />} onClose={closeModal} widthClass="max-w-2xl">
      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="field-label mb-2">General</h3>
          <ul className="flex flex-col gap-1.5">
            {GENERAL.map(([label, keys]) => (
              <li key={label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700 dark:text-slate-200">{label}</span>
                <Keys keys={keys} />
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="field-label mb-2">Tools</h3>
          <ul className="flex flex-col gap-1.5">
            {ALL_TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <li key={tool.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Icon size={15} className="text-slate-400" /> {tool.label}
                  </span>
                  <Keys keys={[tool.key.toUpperCase()]} />
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </Modal>
  )
}
