import { useEffect, useState } from 'react'
import MonacoEditor, { DiffEditor } from '@monaco-editor/react'
import { useEditorStore } from '@/stores/editorStore'
import { useThemeStore, MONACO_THEMES } from '@/stores/themeStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useDisplayStore } from '@/stores/displayStore'
import { useFileStore } from '@/stores/fileStore'
import { useGitStore } from '@/stores/gitStore'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'
import { TabBar } from './TabBar'
import { detectLang } from './utils'
import {
  isSettingsTab,
  isGitLogTab,
  isGitGraphTab,
  isGitBranchDiffTab,
  DISPLAY_TAB_PATH,
  EDITOR_SETTINGS_TAB_PATH,
  GIT_SETTINGS_TAB_PATH,
} from '@/components/Settings/paths'
import { DisplayPage } from '@/components/Settings/DisplayPage'
import { GitSettingsPage } from '@/components/Settings/GitSettingsPage'
import { EditorSettingsPage } from '@/components/Settings/EditorSettingsPage'
import { isGitDiffTab, parseGitDiffPath } from '@/components/Git/paths'
import { GitLogView } from '@/components/Git/GitLogView'
import { GitGraphPage } from '@/components/Git/GitGraphPage'
import { GitBranchDiffPage } from '@/components/Git/GitBranchDiffPage'
import type { GitDiffContent } from '@/types/index'

export function Editor() {
  const { tabs, activeTabPath, updateContent } = useEditorStore()
  const activeTab = tabs.find((t) => t.path === activeTabPath)
  const isVirtual = !!activeTab && isSettingsTab(activeTab.path)
  const isDiff = !!activeTab && isGitDiffTab(activeTab.path)
  const isGitLog = !!activeTab && isGitLogTab(activeTab.path)
  const isGitGraph = !!activeTab && isGitGraphTab(activeTab.path)
  const isGitBranchDiff = !!activeTab && isGitBranchDiffTab(activeTab.path)
  const monacoTheme = useThemeStore((s) => MONACO_THEMES[s.theme])
  const fontSize = useFontSizeStore((s) => s.fontSize)
  const font = useDisplayStore((s) => s.font)
  const autoSaveEnabled = useEditorSettingsStore((s) => s.autoSaveEnabled)
  const projectRoot = useFileStore((s) => s.projectRoot)
  const [diffContent, setDiffContent] = useState<GitDiffContent | null>(null)

  function saveActiveTab() {
    const { tabs, activeTabPath, markSaved } = useEditorStore.getState()
    const tab = tabs.find((t) => t.path === activeTabPath)
    if (!tab) return
    if (
      isSettingsTab(tab.path) ||
      isGitDiffTab(tab.path) ||
      isGitLogTab(tab.path) ||
      isGitGraphTab(tab.path) ||
      isGitBranchDiffTab(tab.path)
    ) return

    const savedContent = tab.content
    window.api.writeFile(tab.path, savedContent).then(() => {
      markSaved(tab.path, savedContent)
      const root = useFileStore.getState().projectRoot
      if (root) useGitStore.getState().refreshStatus(root)
    })
  }

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
    if (!activeTab || isVirtual || isDiff || isGitLog || isGitGraph || isGitBranchDiff) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveActiveTab()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab, isVirtual, isDiff, isGitLog, isGitGraph, isGitBranchDiff, projectRoot])

  useEffect(() => {
    if (!autoSaveEnabled || !activeTab?.dirty) return
    if (isVirtual || isDiff || isGitLog || isGitGraph || isGitBranchDiff) return

    const timeout = setTimeout(() => {
      saveActiveTab()
    }, 700)

    return () => clearTimeout(timeout)
  }, [
    autoSaveEnabled,
    activeTab?.path,
    activeTab?.content,
    activeTab?.dirty,
    isVirtual,
    isDiff,
    isGitLog,
    isGitGraph,
    isGitBranchDiff,
  ])

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      <TabBar />
      {activeTab ? (
        isVirtual ? (
          activeTab.path === GIT_SETTINGS_TAB_PATH ? (
            <GitSettingsPage />
          ) : activeTab.path === EDITOR_SETTINGS_TAB_PATH ? (
            <EditorSettingsPage />
          ) : activeTab.path === DISPLAY_TAB_PATH ? (
            <DisplayPage />
          ) : (
            <DisplayPage />
          )
        ) : isGitLog ? (
          <GitLogView />
        ) : isGitGraph ? (
          <GitGraphPage />
        ) : isGitBranchDiff ? (
          <GitBranchDiffPage />
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
              onMount={(editor, monaco) => {
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                  saveActiveTab()
                })
              }}
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
