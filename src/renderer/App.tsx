import PageList from './components/PageList'
import Toolbar from './components/Toolbar'

export default function App(): JSX.Element {
  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100">
      <Toolbar />
      <div className="min-h-0 flex-1">
        <PageList />
      </div>
    </div>
  )
}
