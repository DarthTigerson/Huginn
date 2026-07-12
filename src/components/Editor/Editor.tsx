import { useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useEditorStore } from '@/stores/editorStore'
import { useThemeStore, MONACO_THEMES } from '@/stores/themeStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useDisplayStore } from '@/stores/displayStore'
import { TabBar } from './TabBar'
import { detectLang } from './utils'
import { isSettingsTab, DISPLAY_TAB_PATH } from '@/components/Settings/paths'
import { ThemesPage } from '@/components/Settings/ThemesPage'
import { DisplayPage } from '@/components/Settings/DisplayPage'

export function Editor() {
  const { tabs, activeTabPath, updateContent } = useEditorStore()
  const activeTab = tabs.find((t) => t.path === activeTabPath)
  const isVirtual = !!activeTab && isSettingsTab(activeTab.path)
  const monacoTheme = useThemeStore((s) => MONACO_THEMES[s.theme])
  const fontSize = useFontSizeStore((s) => s.fontSize)
  const font = useDisplayStore((s) => s.font)

  useEffect(() => {
    if (!activeTab || isVirtual) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        window.api.writeFile(activeTab.path, activeTab.content)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab, isVirtual])

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      <TabBar />
      {activeTab ? (
        isVirtual ? (
          activeTab.path === DISPLAY_TAB_PATH ? <DisplayPage /> : <ThemesPage />
        ) : (
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              key={activeTab.path}
              value={activeTab.content}
              language={detectLang(activeTab.path)}
              theme={monacoTheme}
              options={{
                fontSize,
                fontFamily: font,
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
        )
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-fg-subtle text-sm">Open a file to start editing</p>
        </div>
      )}
    </div>
  )
}
