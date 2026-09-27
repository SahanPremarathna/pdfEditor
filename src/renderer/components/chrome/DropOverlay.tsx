import { FileUp } from 'lucide-react'

/** Full-window hint shown while a file is dragged over the app. */
export default function DropOverlay({ visible }: { visible: boolean }): JSX.Element | null {
  if (!visible) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-ink-900/20 p-6 backdrop-blur-sm">
      <div className="glass-strong flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-ink-400/60 px-12 py-10 text-center">
        <div className="bg-accent-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-ink-600/30">
          <FileUp size={26} />
        </div>
        <p className="text-lg font-semibold">Drop to open</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">PDFs open here · images drop onto a page</p>
      </div>
    </div>
  )
}
