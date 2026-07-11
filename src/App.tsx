import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'

export default function App() {
  return (
    <div className="w-screen h-screen bg-panel flex overflow-hidden">
      <div className="w-64 shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor />
      </div>
    </div>
  )
}
