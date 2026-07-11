import { useEffect, useRef, useState } from 'react'
import { ImperativePanelHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { Terminal } from './components/Terminal/Terminal'
import { Chat } from './components/Chat/Chat'
import { ActivityBar, FilesIcon, ClaudeIcon } from './components/ActivityBar/ActivityBar'
import { useTerminalStore } from './stores/terminalStore'
import { useFileStore } from './stores/fileStore'

export default function App() {
  const termVisible = useTerminalStore((s) => s.visible)
  const projectRoot = useFileStore((s) => s.projectRoot)
  const repoName = projectRoot ? projectRoot.split('/').pop() : null
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [chatVisible, setChatVisible] = useState(true)
  const chatPanelRef = useRef<ImperativePanelHandle>(null)

  useEffect(() => {
    if (chatVisible) chatPanelRef.current?.expand()
    else chatPanelRef.current?.collapse()
  }, [chatVisible])

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
    <div className="w-screen h-screen overflow-hidden bg-panel flex flex-col">
      <div
        className="h-8 shrink-0 flex items-center justify-center bg-tab-bar border-b border-border"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {repoName && (
          <span className="text-sm font-medium text-gray-400">{repoName}</span>
        )}
      </div>
      <div className="flex flex-1 min-h-0">
        <ActivityBar
          side="left"
          items={[{
            id: 'files',
            icon: <FilesIcon />,
            title: 'Explorer',
            active: sidebarVisible,
            onClick: () => setSidebarVisible((v) => !v),
          }]}
        />
        <PanelGroup direction="horizontal" className="flex-1">
          {sidebarVisible && (
            <>
              <Panel defaultSize={20} minSize={12} maxSize={40} id="sidebar" order={1}>
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-px bg-border hover:bg-accent/60 transition-colors cursor-col-resize" />
            </>
          )}

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

          <PanelResizeHandle className={`w-px bg-border hover:bg-accent/60 transition-colors cursor-col-resize ${chatVisible ? '' : 'hidden'}`} />
          <Panel
            ref={chatPanelRef}
            defaultSize={25}
            minSize={15}
            maxSize={50}
            collapsible
            id="chat"
            order={3}
          >
            <Chat />
          </Panel>
        </PanelGroup>
        <ActivityBar
          side="right"
          showAccent={false}
          items={[{
            id: 'claude',
            icon: <ClaudeIcon />,
            title: 'Claude Code',
            active: chatVisible,
            onClick: () => setChatVisible((v) => !v),
          }]}
        />
      </div>
    </div>
  )
}
