import { useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useEditorStore } from '@/stores/editorStore'
import { TabBar } from './TabBar'
import { detectLang } from './utils'

export function Editor() {
  const { tabs, activeTabPath, updateContent } = useEditorStore()
  const activeTab = tabs.find((t) => t.path === activeTabPath)

  useEffect(() => {
    if (!activeTab) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        window.api.writeFile(activeTab.path, activeTab.content)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab])

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      <TabBar />
      {activeTab ? (
        <div className="flex-1 overflow-hidden">
          <MonacoEditor
            key={activeTab.path}
            value={activeTab.content}
            language={detectLang(activeTab.path)}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderLineHighlight: 'all',
              padding: { top: 8 },
              automaticLayout: true,
            }}
            onChange={(val) => updateContent(activeTab.path, val ?? '')}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-sm">Open a file to start editing</p>
        </div>
      )}
    </div>
  )
}
