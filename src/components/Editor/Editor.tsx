import { useEffect, useState } from 'react'
import MonacoEditor, { DiffEditor } from '@monaco-editor/react'
import { useEditorStore } from '@/stores/editorStore'
import { useThemeStore, MONACO_THEMES } from '@/stores/themeStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useDisplayStore } from '@/stores/displayStore'
import { useFileStore } from '@/stores/fileStore'
import { useGitStore } from '@/stores/gitStore'
import { TabBar } from './TabBar'
import { detectLang } from './utils'
import { isSettingsTab, isGitLogTab, isGitGraphTab, GIT_SETTINGS_TAB_PATH } from '@/components/Settings/paths'
import { DisplayPage } from '@/components/Settings/DisplayPage'
import { GitSettingsPage } from '@/components/Settings/GitSettingsPage'
import { isGitDiffTab, parseGitDiffPath } from '@/components/Git/paths'
import { GitLogView } from '@/components/Git/GitLogView'
import { GitGraphPage } from '@/components/Git/GitGraphPage'
import type { GitDiffContent } from '@/types/index'

export function Editor() {
  const { tabs, activeTabPath, updateContent } = useEditorStore()
  const activeTab = tabs.find((t) => t.path === activeTabPath)
  const isVirtual = !!activeTab && isSettingsTab(activeTab.path)
  const isDiff = !!activeTab && isGitDiffTab(activeTab.path)
  const isGitLog = !!activeTab && isGitLogTab(activeTab.path)
  const isGitGraph = !!activeTab && isGitGraphTab(activeTab.path)
  const monacoTheme = useThemeStore((s) => MONACO_THEMES[s.theme])
  const fontSize = useFontSizeStore((s) => s.fontSize)
  const font = useDisplayStore((s) => s.font)
  const projectRoot = useFileStore((s) => s.projectRoot)
  const [diffContent, setDiffContent] = useState<GitDiffContent | null>(null)

  useEffect(() => {
    if (!activeTab || !isDiff || !projectRoot) {
      setDiffContent(null)
      return
    }
    const { path, staged } = parseGitDiffPath(activeTab.path)
    let cancelled = false
    window.api.gitDiff(projectRoot, path, staged).then((content) => {
      if (!cancelled) setDiffContent(content)
    })
    return () => {
      cancelled = true
    }
  }, [activeTab?.path, isDiff, projectRoot])

  useEffect(() => {
    if (!activeTab || isVirtual || isDiff || isGitLog || isGitGraph) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        window.api.writeFile(activeTab.path, activeTab.content).then(() => {
          if (projectRoot) useGitStore.getState().refreshStatus(projectRoot)
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab, isVirtual, isDiff, isGitLog, projectRoot])

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      <TabBar />
      {activeTab ? (
        isVirtual ? (
          activeTab?.path === GIT_SETTINGS_TAB_PATH ? <GitSettingsPage /> : <DisplayPage />
        ) : isGitLog ? (
          <GitLogView />
        ) : isGitGraph ? (
          <GitGraphPage />
        ) : isDiff ? (
          <div className="flex-1 overflow-hidden">
            {diffContent && (
              <DiffEditor
                key={activeTab.path}
                original={diffContent.original}
                modified={diffContent.modified}
                language={detectLang(activeTab.path)}
                theme={monacoTheme}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  fontSize,
                  fontFamily: font,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            )}
          </div>
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
