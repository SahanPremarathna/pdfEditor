import PageList from './components/PageList'
import PropertiesPanel from './components/PropertiesPanel'
import Toolbar from './components/Toolbar'
import { useDeleteSelectedObject } from './hooks/useDeleteSelectedObject'

export default function App(): JSX.Element {
  useDeleteSelectedObject()

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <PageList />
        </div>
        <PropertiesPanel />
      </div>
    </div>
  )
}
