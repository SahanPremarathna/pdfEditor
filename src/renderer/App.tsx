import PageList from './components/PageList'
import PropertiesPanel from './components/PropertiesPanel'
import SignaturePadModal from './components/SignaturePadModal'
import ThumbnailRail from './components/ThumbnailRail'
import Toolbar from './components/Toolbar'
import { useDeleteSelectedObject } from './hooks/useDeleteSelectedObject'
import { useImagePasteHandler } from './hooks/useImagePasteHandler'
import { useSaveShortcut } from './hooks/useSaveShortcut'
import { useUndoRedoShortcut } from './hooks/useUndoRedoShortcut'

export default function App(): JSX.Element {
  useDeleteSelectedObject()
  useSaveShortcut()
  useImagePasteHandler()
  useUndoRedoShortcut()

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <ThumbnailRail />
        <div className="min-w-0 flex-1">
          <PageList />
        </div>
        <PropertiesPanel />
      </div>
      <SignaturePadModal />
    </div>
  )
}
