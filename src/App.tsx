import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { Terminal } from './components/Terminal/Terminal'
import { useTerminalStore } from './stores/terminalStore'

export default function App() {
  const termVisible = useTerminalStore((s) => s.visible)

  return (
    <div className="w-screen h-screen bg-panel flex overflow-hidden">
      <div className="w-64 shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={termVisible ? 'flex-1 overflow-hidden' : 'h-full overflow-hidden'}>
          <Editor />
        </div>
        {termVisible && (
          <div className="h-48 shrink-0">
            <Terminal />
          </div>
        )}
      </div>
    </div>
  )
}
