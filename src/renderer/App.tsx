import { PanelLeft } from 'lucide-react'
import AmbientBackground from './components/chrome/AmbientBackground'
import DropOverlay from './components/chrome/DropOverlay'
import StatusPill from './components/chrome/StatusPill'
import Toasts from './components/chrome/Toasts'
import ToolDock from './components/chrome/ToolDock'
import TopBar from './components/chrome/TopBar'
import Welcome from './components/chrome/Welcome'
import ExtractModal from './components/modals/ExtractModal'
import PasswordModal from './components/modals/PasswordModal'
import ShortcutsModal from './components/modals/ShortcutsModal'
import SupportModal from './components/support/SupportModal'
import SupportNudge from './components/support/SupportNudge'
import PageList from './components/PageList'
import RightPanel from './components/RightPanel'
import SignaturePadModal from './components/SignaturePadModal'
import ThumbnailRail from './components/ThumbnailRail'
import { useGlobalPdfDrop, useLaunchQueue, useOfflineSupport, useTheme } from './hooks/useAppShell'
import { useDeleteSelectedObject } from './hooks/useDeleteSelectedObject'
import { useEditorShortcuts } from './hooks/useEditorShortcuts'
import { useEscapeShortcut } from './hooks/useEscapeShortcut'
import { useFileShortcuts } from './hooks/useFileShortcuts'
import { useImagePasteHandler } from './hooks/useImagePasteHandler'
import { useLaunchFileOpen } from './hooks/useLaunchFileOpen'
import { useMenuActions } from './hooks/useMenuActions'
import { useSaveShortcut } from './hooks/useSaveShortcut'
import { useUndoRedoShortcut } from './hooks/useUndoRedoShortcut'
import { useZoomShortcut } from './hooks/useZoomShortcut'
import { useDocumentStore } from './store/documentStore'
import { useUiStore } from './store/uiStore'

/** Top offset for side columns — clears the floating top bar. */
const CHROME_TOP = 'pt-[76px]'

function Editor(): JSX.Element {
  const isPagesPanelOpen = useUiStore((s) => s.isPagesPanelOpen)
  const setPagesPanelOpen = useUiStore((s) => s.setPagesPanelOpen)

  return (
    <div className="absolute inset-0 flex">
      {/* Left chrome: tool dock + pages panel. On phones the dock docks to
          the bottom edge and the pages panel overlays the document. */}
      <div className={`pointer-events-none absolute inset-y-0 left-0 z-20 flex gap-3 p-3 ${CHROME_TOP} md:relative md:pr-0`}>
        <div className="flex flex-col gap-3">
          <ToolDock />
          {!isPagesPanelOpen && (
            <button
              type="button"
              onClick={() => setPagesPanelOpen(true)}
              className="glass icon-btn tip tip-right pointer-events-auto h-12 w-12 rounded-2xl max-md:h-10 max-md:w-10"
              data-tip="Show pages"
              aria-label="Show pages panel"
            >
              <PanelLeft size={18} />
            </button>
          )}
        </div>
        <div className="flex min-h-0 max-md:pb-16">
          <ThumbnailRail />
        </div>
      </div>

      <main className="relative min-w-0 flex-1">
        <PageList />
      </main>

      <div
        className={`pointer-events-none absolute right-0 top-0 z-20 flex max-h-full flex-col items-end p-3 ${CHROME_TOP}
          max-md:inset-x-0 max-md:bottom-[112px] max-md:top-auto max-md:max-h-[50vh] max-md:pt-3 md:relative md:bottom-0 md:pl-0`}
      >
        <RightPanel />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center max-md:bottom-[68px]">
        <StatusPill />
      </div>
    </div>
  )
}

export default function App(): JSX.Element {
  useDeleteSelectedObject()
  useSaveShortcut()
  useImagePasteHandler()
  useUndoRedoShortcut()
  useFileShortcuts()
  useZoomShortcut()
  useEscapeShortcut()
  useEditorShortcuts()
  useMenuActions()
  useLaunchFileOpen()
  useLaunchQueue()
  useOfflineSupport()
  useTheme()
  const isDraggingFile = useGlobalPdfDrop()
  const hasDoc = useDocumentStore((s) => s.pdfDoc !== null)

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AmbientBackground />
      {hasDoc ? <Editor /> : <Welcome />}
      <TopBar />
      <Toasts />
      <SignaturePadModal />
      <PasswordModal />
      <ShortcutsModal />
      <ExtractModal />
      <SupportModal />
      <SupportNudge />
      <DropOverlay visible={isDraggingFile} />
    </div>
  )
}
