import { useEffect, useRef, useState } from 'react'
import MonacoEditor, { DiffEditor } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useEditorStore, type EditorLayoutNode } from '@/stores/editorStore'
import { useSearchStore } from '@/stores/searchStore'
import { useThemeStore, MONACO_THEMES } from '@/stores/themeStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useDisplayStore } from '@/stores/displayStore'
import { useFileStore } from '@/stores/fileStore'
import { useGitStore } from '@/stores/gitStore'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'
import { useClaudeStore } from '@/stores/claudeStore'
import { TabBar } from './TabBar'
import { detectLang } from './utils'
import {
  isSettingsTab,
  isGitLogTab,
  isGitGraphTab,
  isGitBranchDiffTab,
  isTerminalTab,
  getTerminalId,
  DISPLAY_TAB_PATH,
  EDITOR_SETTINGS_TAB_PATH,
  GIT_SETTINGS_TAB_PATH,
} from '@/components/Settings/paths'
import { TerminalTab } from '@/components/Terminal/TerminalTab'
import { DisplayPage } from '@/components/Settings/DisplayPage'
import { GitSettingsPage } from '@/components/Settings/GitSettingsPage'
import { EditorSettingsPage } from '@/components/Settings/EditorSettingsPage'
import { isGitDiffTab, parseGitDiffPath } from '@/components/Git/paths'
import { GitLogView } from '@/components/Git/GitLogView'
import { GitGraphPage } from '@/components/Git/GitGraphPage'
import { GitBranchDiffPage } from '@/components/Git/GitBranchDiffPage'
import type { GitDiffContent, Tab } from '@/types/index'

function isVirtualTab(tab: Tab | null): boolean {
  return !!tab && (isSettingsTab(tab.path) || isTerminalTab(tab.path))
}

function isReadOnlyTab(tab: Tab | null): boolean {
  return !!tab && (
    isSettingsTab(tab.path) ||
    isGitDiffTab(tab.path) ||
    isGitLogTab(tab.path) ||
    isGitGraphTab(tab.path) ||
    isGitBranchDiffTab(tab.path) ||
    isTerminalTab(tab.path)
  )
}

async function saveActiveTab({ allowCreateMissing }: { allowCreateMissing: boolean }) {
  const { tabs, activeTabPath, markSaved, setTabMissing } = useEditorStore.getState()
  const tab = tabs.find((t) => t.path === activeTabPath)
  if (!tab || isReadOnlyTab(tab)) return

  if (!allowCreateMissing) {
    const exists = await window.api.pathExists(tab.path)
    if (!exists) {
      setTabMissing(tab.path, true)
      return
    }
  }

  const savedContent = tab.content
  await window.api.writeFile(tab.path, savedContent)
  markSaved(tab.path, savedContent)
  const root = useFileStore.getState().projectRoot
  if (root) {
    useFileStore.getState().refreshRoot()
    useGitStore.getState().refreshStatus(root)
  }
}

export function Editor() {
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabPath = useEditorStore((s) => s.activeTabPath)
  const layout = useEditorStore((s) => s.layout)
  const splitActivePane = useEditorStore((s) => s.splitActivePane)
  const autoSaveEnabled = useEditorSettingsStore((s) => s.autoSaveEnabled)
  const activeTab = tabs.find((t) => t.path === activeTabPath) ?? null

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return

      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        saveActiveTab({ allowCreateMissing: true })
      }

      if (key === 'd') {
        e.preventDefault()
        splitActivePane(e.shiftKey ? 'vertical' : 'horizontal')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [splitActivePane])

  useEffect(() => {
    if (!autoSaveEnabled || !activeTab?.dirty || isReadOnlyTab(activeTab)) return

    const timeout = setTimeout(() => {
      saveActiveTab({ allowCreateMissing: false })
    }, 700)

    return () => clearTimeout(timeout)
  }, [
    autoSaveEnabled,
    activeTab?.path,
    activeTab?.content,
    activeTab?.dirty,
  ])

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      {tabs.length > 0 ? (
        <div className="flex-1 min-h-0">
          <EditorLayout node={layout} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-fg-subtle text-sm">Open a file to start editing</p>
        </div>
      )}
    </div>
  )
}

function EditorLayout({ node }: { node: EditorLayoutNode }) {
  if (node.type === 'pane') {
    return <EditorPane paneId={node.id} />
  }

  const horizontal = node.direction === 'horizontal'

  return (
    <PanelGroup
      direction={horizontal ? 'horizontal' : 'vertical'}
      className="h-full min-h-0"
    >
      <Panel minSize={15}>
        <EditorLayout node={node.children[0]} />
      </Panel>
      <PanelResizeHandle
        className={[
          'bg-border hover:bg-accent/60 transition-colors',
          horizontal ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize',
        ].join(' ')}
      />
      <Panel minSize={15}>
        <EditorLayout node={node.children[1]} />
      </Panel>
    </PanelGroup>
  )
}

function EditorPane({ paneId }: { paneId: string }) {
  const tabs = useEditorStore((s) => s.tabs)
  const paneTabs = useEditorStore((s) => s.paneTabs)
  const activePaneId = useEditorStore((s) => s.activePaneId)
  const setActivePane = useEditorStore((s) => s.setActivePane)
  const updateContent = useEditorStore((s) => s.updateContent)
  const revealRequest = useEditorStore((s) => s.revealRequest)
  const monacoTheme = useThemeStore((s) => MONACO_THEMES[s.theme])
  const fontSize = useFontSizeStore((s) => s.fontSize)
  const font = useDisplayStore((s) => s.font)
  const projectRoot = useFileStore((s) => s.projectRoot)
  const [diffContent, setDiffContent] = useState<GitDiffContent | null>(null)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)

  const tabPath = paneTabs[paneId]
  const activeTab = tabs.find((t) => t.path === tabPath) ?? null
  const isActivePane = activePaneId === paneId
  const isVirtual = isVirtualTab(activeTab)
  const isTerminal = !!activeTab && isTerminalTab(activeTab.path)
  const isDiff = !!activeTab && isGitDiffTab(activeTab.path)
  const isGitLog = !!activeTab && isGitLogTab(activeTab.path)
  const isGitGraph = !!activeTab && isGitGraphTab(activeTab.path)
  const isGitBranchDiff = !!activeTab && isGitBranchDiffTab(activeTab.path)

  function activatePane() {
    setActivePane(paneId)
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
    if (!activeTab || isReadOnlyTab(activeTab)) return

    let cancelled = false
    window.api.pathExists(activeTab.path).then((exists) => {
      if (!cancelled) {
        useEditorStore.getState().setTabMissing(activeTab.path, !exists)
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeTab?.path])

  useEffect(() => {
    if (!revealRequest || revealRequest.path !== tabPath) return
    const editor = editorRef.current
    if (!editor) return

    editor.revealLineInCenter(revealRequest.line)
    editor.setPosition({ lineNumber: revealRequest.line, column: revealRequest.col })
    editor.focus()

    const model = editor.getModel()
    if (model) {
      decorationsRef.current?.clear()
      decorationsRef.current = editor.createDecorationsCollection([{
        range: {
          startLineNumber: revealRequest.line,
          startColumn: revealRequest.col,
          endLineNumber: revealRequest.line,
          endColumn: revealRequest.col + revealRequest.searchTerm.length,
        },
        options: { inlineClassName: 'search-reveal-highlight' },
      }])
      setTimeout(() => decorationsRef.current?.clear(), 3000)
    }

    useEditorStore.getState().clearRevealRequest()
  }, [revealRequest, tabPath])

  return (
    <div
      className={[
        'h-full min-h-0 flex flex-col bg-panel overflow-hidden outline outline-1 -outline-offset-1',
        isActivePane ? 'outline-accent/50' : 'outline-transparent',
      ].join(' ')}
      onMouseDown={activatePane}
    >
      <TabBar paneId={paneId} />
      <div className="flex-1 min-h-0 overflow-hidden">
      {activeTab ? (
        isTerminal ? (
          <TerminalTab key={activeTab.path} terminalId={getTerminalId(activeTab.path)} />
        ) : isVirtual ? (
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
          <div className="h-full overflow-hidden">
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
          <div className="h-full overflow-hidden">
            <MonacoEditor
              key={`${paneId}:${activeTab.path}`}
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
                editorRef.current = editor
                editor.onDidFocusEditorWidget(activatePane)
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                  activatePane()
                  saveActiveTab({ allowCreateMissing: true })
                })
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
                  activatePane()
                  useEditorStore.getState().splitActivePane('horizontal')
                })
                editor.addCommand(
                  monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD,
                  () => {
                    activatePane()
                    useEditorStore.getState().splitActivePane('vertical')
                  }
                )
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
                  useSearchStore.getState().openSearch(false)
                })
                editor.addCommand(
                  monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
                  () => { useSearchStore.getState().openSearch(true) }
                )
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
                  useSearchStore.getState().openCommandPalette()
                })
                editor.addCommand(
                  monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
                  () => { useSearchStore.getState().openActionPalette() }
                )
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyT, () => {
                  const id = Date.now().toString(36)
                  useEditorStore.getState().openTab({ path: `terminal://${id}`, content: '', dirty: false })
                })
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
                  useClaudeStore.getState().toggleChatVisible()
                })

                // handle reveal if request was set before this editor mounted
                const req = useEditorStore.getState().revealRequest
                if (req && req.path === activeTab?.path) {
                  editor.revealLineInCenter(req.line)
                  editor.setPosition({ lineNumber: req.line, column: req.col })
                  editor.focus()
                  decorationsRef.current = editor.createDecorationsCollection([{
                    range: {
                      startLineNumber: req.line,
                      startColumn: req.col,
                      endLineNumber: req.line,
                      endColumn: req.col + req.searchTerm.length,
                    },
                    options: { inlineClassName: 'search-reveal-highlight' },
                  }])
                  setTimeout(() => decorationsRef.current?.clear(), 3000)
                  useEditorStore.getState().clearRevealRequest()
                }
              }}
            />
          </div>
        )
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-fg-subtle text-sm">Select a tab for this pane</p>
        </div>
      )}
      </div>
    </div>
  )
}
