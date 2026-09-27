import { Scissors } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { formatPageRanges, parsePageSelection } from '../../core/extractPages'
import { useDocumentStore } from '../../store/documentStore'
import { useUiStore } from '../../store/uiStore'
import Modal from './Modal'

/** The extract form itself — see ExtractModal below. */
function ExtractForm(): JSX.Element {
  const closeModal = useUiStore((s) => s.closeModal)
  const currentPageId = useUiStore((s) => s.currentPageId)
  const pages = useDocumentStore((s) => s.pages)
  const isSaving = useDocumentStore((s) => s.isSaving)
  const extractPages = useDocumentStore((s) => s.extractPages)

  const visible = useMemo(() => pages.filter((p) => !p.deleted), [pages])
  const currentNumber = Math.max(1, visible.findIndex((p) => p.index === currentPageId) + 1)
  const [input, setInput] = useState(() => String(currentNumber))

  const selection = parsePageSelection(input, visible.length)

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault()
    if (!selection) return
    const ids = selection.map((n) => visible[n - 1].index)
    void extractPages(ids).then(closeModal)
  }

  return (
    <Modal
      title="Extract pages"
      subtitle="Save selected pages — with all your edits — as a new PDF."
      icon={<Scissors size={18} />}
      onClose={closeModal}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Pages (of {visible.length})</span>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. 1-3, 5, 8-"
            className="input h-10"
            aria-invalid={!selection}
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[
            ['Current page', String(currentNumber)],
            ['All pages', `1-${visible.length}`],
            ['Odd pages', visible.map((_, i) => i + 1).filter((n) => n % 2 === 1).join(',')],
            ['Even pages', visible.map((_, i) => i + 1).filter((n) => n % 2 === 0).join(',')]
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <button key={label} type="button" className="btn btn-outline h-7 rounded-lg px-2.5 text-xs" onClick={() => setInput(value)}>
                {label}
              </button>
            ))}
        </div>
        <p className="min-h-5 text-sm text-slate-500 dark:text-slate-400">
          {selection
            ? `${selection.length} page${selection.length === 1 ? '' : 's'}: ${formatPageRanges(selection)}`
            : 'Enter page numbers or ranges, separated by commas.'}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!selection || isSaving}>
            {isSaving ? 'Preparing…' : 'Extract'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Downloads a new PDF made of a typed page selection ("1-3, 5"). Mounted
 *  fresh on each open so the field starts at the current page. */
export default function ExtractModal(): JSX.Element | null {
  const activeModal = useUiStore((s) => s.activeModal)
  return activeModal === 'extract' ? <ExtractForm /> : null
}
