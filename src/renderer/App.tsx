import PageList from './components/PageList'
import PropertiesPanel from './components/PropertiesPanel'
import SignaturePadModal from './components/SignaturePadModal'
import Toolbar from './components/Toolbar'
import { useDeleteSelectedObject } from './hooks/useDeleteSelectedObject'
import { useImagePasteHandler } from './hooks/useImagePasteHandler'
import { useSaveShortcut } from './hooks/useSaveShortcut'

export default function App(): JSX.Element {
  useDeleteSelectedObject()
  useSaveShortcut()
  useImagePasteHandler()

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <PageList />
        </div>
        <PropertiesPanel />
      </div>
      <SignaturePadModal />
    </div>
  )
}
