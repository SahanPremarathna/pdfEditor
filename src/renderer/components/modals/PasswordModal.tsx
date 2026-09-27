import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDocumentStore } from '../../store/documentStore'
import Modal from './Modal'

export default function PasswordModal(): JSX.Element | null {
  const prompt = useDocumentStore((s) => s.passwordPrompt)
  const isLoading = useDocumentStore((s) => s.isLoading)
  const submitPassword = useDocumentStore((s) => s.submitPassword)
  const cancelPassword = useDocumentStore((s) => s.cancelPassword)
  const [password, setPassword] = useState('')

  if (!prompt) return null

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault()
    const value = password
    setPassword('')
    void submitPassword(value)
  }

  return (
    <Modal
      title="Password required"
      subtitle={`“${prompt.fileName}” is protected.`}
      icon={<KeyRound size={18} />}
      onClose={cancelPassword}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          autoFocus
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Document password"
          className="input h-10"
          aria-invalid={prompt.incorrect}
        />
        {prompt.incorrect && <p className="text-sm text-rose-600 dark:text-rose-400">That password didn't work. Try again.</p>}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Unlocked documents can be viewed and annotated. Saving encrypted PDFs isn't supported yet.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={cancelPassword}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
