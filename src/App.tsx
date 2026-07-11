import { useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { Terminal } from './components/Terminal/Terminal'
import { Chat } from './components/Chat/Chat'
import { useTerminalStore } from './stores/terminalStore'

export default function App() {
  const termVisible = useTerminalStore((s) => s.visible)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault()
        useTerminalStore.getState().toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="w-screen h-screen overflow-hidden bg-panel">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={20} minSize={12} maxSize={40} id="sidebar" order={1}>
          <Sidebar />
        </Panel>

        <PanelResizeHandle className="w-px bg-border hover:bg-accent/60 transition-colors cursor-col-resize" />

        <Panel id="center" order={2}>
          <PanelGroup direction="vertical" className="h-full">
            <Panel id="editor" order={1}>
              <Editor />
            </Panel>

            {termVisible && (
              <>
                <PanelResizeHandle className="h-px bg-border hover:bg-accent/60 transition-colors cursor-row-resize" />
                <Panel defaultSize={28} minSize={10} id="terminal" order={2}>
                  <Terminal />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="w-px bg-border hover:bg-accent/60 transition-colors cursor-col-resize" />

        <Panel defaultSize={25} minSize={15} maxSize={50} id="chat" order={3}>
          <Chat />
        </Panel>
      </PanelGroup>
    </div>
  )
}
