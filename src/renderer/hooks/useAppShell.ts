import { useEffect, useState } from 'react'
import { prefetchBundledFonts } from '../core/fontAssets'
import { isWebHost } from '../platform'
import { useDocumentStore } from '../store/documentStore'
import { useUiStore } from '../store/uiStore'

/** Applies the theme preference to <html data-theme>, following the OS
 *  setting live while the preference is 'system'. */
export function useTheme(): 'light' | 'dark' {
  const theme = useUiStore((s) => s.theme)
  const [systemDark, setSystemDark] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0b0b1a' : '#eef0f7')
  }, [resolved])
  return resolved
}

const hasFiles = (e: DragEvent): boolean => e.dataTransfer?.types.includes('Files') ?? false

/**
 * Drop a PDF anywhere to open it. Returns whether a file drag is currently
 * over the window (for the drop overlay). Image drops onto a page are
 * handled — and preventDefault'ed — by PageCanvas first, so only drops that
 * nothing else claimed reach this handler.
 */
export function useGlobalPdfDrop(): boolean {
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    let depth = 0
    const onEnter = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      depth++
      setIsDragging(true)
    }
    const onLeave = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setIsDragging(false)
    }
    const onOver = (e: DragEvent): void => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onDrop = (e: DragEvent): void => {
      depth = 0
      setIsDragging(false)
      if (!hasFiles(e) || e.defaultPrevented) return
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files ?? [])
      const pdf = files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
      if (pdf) {
        void useDocumentStore.getState().openFileObject(pdf)
      } else if (files.length > 0 && !files[0].type.startsWith('image/')) {
        useDocumentStore.getState().showError('Drop a PDF to open it, or an image onto a page to place it.')
      }
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return isDragging
}

/** Registers the offline service worker (browser production builds only)
 *  and, once the app is idle, warms the font cache so Unicode export also
 *  works offline. */
export function useOfflineSupport(): void {
  useEffect(() => {
    if (!isWebHost() || !import.meta.env.PROD || !('serviceWorker' in navigator)) return undefined
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      // Offline support is best-effort; the app works fine without it.
    })
    const timer = window.setTimeout(prefetchBundledFonts, 4000)
    return () => window.clearTimeout(timer)
  }, [])
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** The browser's "install this app" prompt, if it offered one. */
export function useInstallPrompt(): { canInstall: boolean; install: () => void } {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event): void => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = (): void => setDeferred(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  return {
    canInstall: deferred !== null,
    install: () => {
      if (!deferred) return
      void deferred.prompt().finally(() => setDeferred(null))
    }
  }
}

/**
 * PWA file handling: when the installed app is chosen to open a .pdf
 * (OS "Open with"), the browser delivers it through window.launchQueue.
 */
export function useLaunchQueue(): void {
  useEffect(() => {
    interface LaunchParams {
      files: FileSystemFileHandle[]
    }
    const queue = (window as unknown as { launchQueue?: { setConsumer: (cb: (p: LaunchParams) => void) => void } })
      .launchQueue
    queue?.setConsumer((params) => {
      const handle = params.files[0]
      if (!handle) return
      void handle.getFile().then((file) => useDocumentStore.getState().openFileObject(file))
    })
  }, [])
}
