/** Slow-drifting gradient blobs over a faint dot grid — sits behind
 *  everything, never intercepts pointer events. */
export default function AmbientBackground(): JSX.Element {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="ambient-blob-a absolute -left-[15%] -top-[20%] h-[70vmax] w-[70vmax] animate-float-slow rounded-full blur-2xl" />
      <div className="ambient-blob-b absolute -right-[20%] top-[10%] h-[60vmax] w-[60vmax] animate-float-slower rounded-full blur-2xl" />
      <div className="ambient-blob-c absolute -bottom-[30%] left-[20%] h-[60vmax] w-[60vmax] animate-float-slow rounded-full blur-2xl" />
      <div className="dot-grid absolute inset-0 opacity-60" />
    </div>
  )
}
