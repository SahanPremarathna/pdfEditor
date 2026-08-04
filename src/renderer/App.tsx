import PageList from './components/PageList'
import RightPanel from './components/RightPanel'
import SignaturePadModal from './components/SignaturePadModal'
import ThumbnailRail from './components/ThumbnailRail'
import Toolbar from './components/Toolbar'
import { useDeleteSelectedObject } from './hooks/useDeleteSelectedObject'
import { useEscapeShortcut } from './hooks/useEscapeShortcut'
import { useFileShortcuts } from './hooks/useFileShortcuts'
import { useImagePasteHandler } from './hooks/useImagePasteHandler'
import { useMenuActions } from './hooks/useMenuActions'
import { useSaveShortcut } from './hooks/useSaveShortcut'
import { useUndoRedoShortcut } from './hooks/useUndoRedoShortcut'
import { useZoomShortcut } from './hooks/useZoomShortcut'

export default function App(): JSX.Element {
  useDeleteSelectedObject()
  useSaveShortcut()
  useImagePasteHandler()
  useUndoRedoShortcut()
  useFileShortcuts()
  useZoomShortcut()
  useEscapeShortcut()
  useMenuActions()

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <ThumbnailRail />
        <div className="min-w-0 flex-1">
          <PageList />
        </div>
        <RightPanel />
      </div>
      <SignaturePadModal />
    </div>
  )
}
