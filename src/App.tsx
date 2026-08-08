import { useEffect, useRef, useState } from 'react'
import { ImperativePanelHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { ActionPalette } from './components/Search/ActionPalette'
import { ShortcutsOverlay } from './components/Shortcuts/ShortcutsOverlay'
import { useHoldToShowShortcuts } from './components/Shortcuts/useHoldToShowShortcuts'
import { Chat } from './components/Chat/Chat'
import {
  ActivityBar,
  FilesIcon,
  GitIcon,
  TodoIcon,
  PhoneIcon,
  SettingsIcon,
  TerminalIcon,
  BrowserIcon,
  ClaudeIcon,
  CodexIcon,
  CosmosIcon,
  NewSessionIcon,
  PreviousSessionIcon,
  CompactIcon,
  ClearIcon,
  UsageIcon,
  ModelIcon,
  FastIcon,
} from './components/ActivityBar/ActivityBar'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { TodoPanel } from './components/Todos/TodoPanel'
import { GitPanel } from './components/Git/GitPanel'
import { MobileDisplayPanel } from './components/MobileDisplay/MobileDisplayPanel'
import { StatusBar } from './components/StatusBar/StatusBar'
import { CommandPalette } from './components/Search/CommandPalette'
import { SearchModal } from './components/Search/SearchModal'
import { useFileStore } from './stores/fileStore'
import { useClaudeStore } from './stores/claudeStore'
import { useCosmosStore } from './stores/cosmosStore'
import { useCosmosSettingsStore } from './stores/cosmosSettingsStore'
import { useModelSettingsStore } from './stores/modelSettingsStore'
import { useGitStore } from './stores/gitStore'
import { useMobileStore } from './stores/mobileStore'
import { useThemeStore } from './stores/themeStore'
import { useDisplayStore } from './stores/displayStore'
import { useEditorStore } from './stores/editorStore'
import { useSearchStore } from './stores/searchStore'
import { useFontSizeStore } from './stores/fontSizeStore'
import { useInstanceFontSizeStore } from './stores/instanceFontSizeStore'
import { useSidebarUiStore } from './stores/sidebarUiStore'
import { buildTerminalPath, buildBrowserPath } from './components/Settings/paths'
import type { AssistantKind } from './types/api'

const ASSISTANT_OPTIONS: Array<{ id: AssistantKind; label: string }> = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'cosmos', label: 'Cosmos' },
]

function assistantIcon(kind: AssistantKind) {
  return kind === 'claude' ? <ClaudeIcon /> : kind === 'codex' ? <CodexIcon /> : <CosmosIcon />
}

const SIDEBAR_SIZE_KEY = 'huginn:layout:sidebarSize'
const SIDEBAR_DEFAULT_SIZE = 20
const SIDEBAR_MIN_SIZE = 4
const SIDEBAR_MAX_SIZE = 40
const CHAT_SIZE_KEY = 'huginn:layout:chatSize'
const CHAT_DEFAULT_SIZE = 25
const CHAT_MIN_SIZE = 15
const CHAT_MAX_SIZE = 50

function clampSize(size: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, size))
}

function loadSidebarSize(): number {
  const stored = Number(localStorage.getItem(SIDEBAR_SIZE_KEY))
  return Number.isFinite(stored)
    ? clampSize(stored, SIDEBAR_MIN_SIZE, SIDEBAR_MAX_SIZE)
    : SIDEBAR_DEFAULT_SIZE
}

function loadChatSize(): number {
  const stored = Number(localStorage.getItem(CHAT_SIZE_KEY))
  return Number.isFinite(stored)
    ? clampSize(stored, CHAT_MIN_SIZE, CHAT_MAX_SIZE)
    : CHAT_DEFAULT_SIZE
}

export default function App() {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const gitStatus = useGitStore((s) => s.status)
  const refreshGitStatus = useGitStore((s) => s.refreshStatus)
  const assistant = useClaudeStore((s) => s.assistant)
  const usageOpen = useClaudeStore((s) => s.usageOpen)
  const setAssistant = useClaudeStore((s) => s.setAssistant)
  const chatVisible = useClaudeStore((s) => s.chatVisible)
  const enabledModels = useModelSettingsStore((s) => s.enabled)
  const visibleAssistantOptions = ASSISTANT_OPTIONS.filter((option) => enabledModels[option.id])
  const repoName = projectRoot ? projectRoot.split('/').pop() : null
  const [leftPanel, setLeftPanel] = useState<'files' | 'git' | 'todos' | 'mobile' | 'settings' | null>('files')
  const lastLeftPanelRef = useRef<'files' | 'git' | 'todos' | 'mobile' | 'settings'>('files')
  const [sidebarSize, setSidebarSize] = useState(loadSidebarSize)
  const [chatSize, setChatSize] = useState(loadChatSize)
  const [assistantMenuOpen, setAssistantMenuOpen] = useState(false)
  const commandPaletteOpen = useSearchStore((s) => s.commandPaletteOpen)
  const searchOpen = useSearchStore((s) => s.searchOpen)
  const searchCaseSensitive = useSearchStore((s) => s.searchCaseSensitive)
  const actionPaletteOpen = useSearchStore((s) => s.actionPaletteOpen)
  const shortcutsOverlayOpen = useSearchStore((s) => s.shortcutsOverlayOpen)
  const chatPanelRef = useRef<ImperativePanelHandle>(null)
  const assistantLabel = assistant === 'claude' ? 'Claude Code' : assistant === 'codex' ? 'Codex' : 'Cosmos'
  const newSessionTitle = assistant === 'claude' ? 'New Claude Session' : assistant === 'codex' ? 'New Codex Session' : 'New Cosmos Session'
  const previousSessionTitle = assistant === 'claude' ? 'Continue Claude Session' : assistant === 'codex' ? 'Resume Latest Codex Session' : 'Restore Previous Cosmos Session'
  const uncommittedChangeCount = new Set([
    ...gitStatus.staged.map((file) => file.path),
    ...gitStatus.unstaged.map((file) => file.path),
  ]).size
  const gitBadge = uncommittedChangeCount > 99 ? '99+' : uncommittedChangeCount || undefined
  const mobileState = useMobileStore((s) => s.state)
  const mobileBadge = mobileState.running && mobileState.connectedCount > 0 ? mobileState.connectedCount : undefined
  const theme = useThemeStore((s) => s.theme)
  const font = useDisplayStore((s) => s.font)

  function openNewTerminal() {
    const id = Date.now().toString(36)
    useEditorStore.getState().openTab({ path: buildTerminalPath(id), content: '', dirty: false })
  }

  function openNewBrowser() {
    const id = Date.now().toString(36)
    useEditorStore.getState().openTab({ path: buildBrowserPath(id), content: '', dirty: false })
  }

  function saveSidebarSize(size: number) {
    const nextSize = clampSize(size, SIDEBAR_MIN_SIZE, SIDEBAR_MAX_SIZE)
    setSidebarSize(nextSize)
    localStorage.setItem(SIDEBAR_SIZE_KEY, String(nextSize))
  }

  function saveChatSize(size: number) {
    const nextSize = clampSize(size, CHAT_MIN_SIZE, CHAT_MAX_SIZE)
    setChatSize(nextSize)
    localStorage.setItem(CHAT_SIZE_KEY, String(nextSize))
  }

  useEffect(() => {
    useCosmosSettingsStore.getState().init()
    useMobileStore.getState().init()
  }, [])

  useEffect(() => {
    window.api.mobileSetDisplay(theme, font)
  }, [theme, font])

  useEffect(() => {
    if (!assistantMenuOpen) return

    const close = () => setAssistantMenuOpen(false)
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAssistantMenuOpen(false)
    }
    window.addEventListener('click', close)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [assistantMenuOpen])

  useEffect(() => {
    if (chatVisible) chatPanelRef.current?.expand()
    else chatPanelRef.current?.collapse()
  }, [chatVisible])

  useEffect(() => {
    if (leftPanel !== null) lastLeftPanelRef.current = leftPanel
  }, [leftPanel])

  useEffect(() => {
    if (enabledModels[assistant]) return
    const fallback = ASSISTANT_OPTIONS.find((option) => enabledModels[option.id])
    if (fallback) setAssistant(fallback.id)
  }, [enabledModels, assistant, setAssistant])

  useEffect(() => {
    let initialProjectReceived = false
    const unsubscribe = window.api.onMenuOpenInitialProject((projectRoot) => {
      initialProjectReceived = true
      useFileStore.getState().openProjectAt(projectRoot)
    })
    // Give the (synchronous, IPC-ordered-before-any-render) initial-project
    // message a chance to arrive first — main.ts sends it from the window's
    // own 'did-finish-load', which fires before this component's effects run,
    // so by the time this line executes we already know whether one arrived.
    if (!initialProjectReceived) {
      useFileStore.getState().restoreRoot()
    }
    return unsubscribe
  }, [])

  useHoldToShowShortcuts()

  useEffect(() => {
    refreshGitStatus(projectRoot)
    const onFocus = () => refreshGitStatus(projectRoot)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [projectRoot, refreshGitStatus])

  useEffect(() => {
    // Catches git state changes made outside the app's own UI — most
    // commonly commands run in the integrated terminal (checkout, commit,
    // pull...) — which the focus/action-based refreshes above never see.
    return window.api.onGitChanged((cwd) => {
      if (cwd === useFileStore.getState().projectRoot) {
        useGitStore.getState().refresh(cwd)
      }
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuOpenProject(() => {
      useFileStore.getState().openFolder()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuCloseActiveTab(() => {
      useEditorStore.getState().closeActiveTab()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuZoomIn(() => {
      useFontSizeStore.getState().increase()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuZoomOut(() => {
      useFontSizeStore.getState().decrease()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuResetZoom(() => {
      useFontSizeStore.getState().reset()
      useInstanceFontSizeStore.getState().resetAll()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuOpenSettings(() => {
      setLeftPanel('settings')
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuNewFile(() => {
      useSidebarUiStore.getState().requestCreate('file')
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuNewFolder(() => {
      useSidebarUiStore.getState().requestCreate('directory')
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuNewTerminal(() => {
      if (!useFileStore.getState().projectRoot) return
      openNewTerminal()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuReopenClosedTab(() => {
      useEditorStore.getState().reopenLastClosed()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuFind(() => {
      if (!useFileStore.getState().projectRoot) return
      useSearchStore.getState().openSearch(false)
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuFindInFiles(() => {
      if (!useFileStore.getState().projectRoot) return
      useSearchStore.getState().openSearch(true)
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuToggleSidebar(() => {
      setLeftPanel((p) => (p !== null ? null : lastLeftPanelRef.current))
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuCommandPalette(() => {
      if (!useFileStore.getState().projectRoot) return
      useSearchStore.getState().openCommandPalette()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuActionPalette(() => {
      useSearchStore.getState().openActionPalette()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuToggleClaudeChat(() => {
      useClaudeStore.getState().toggleChatVisible()
    })
  }, [])

  useEffect(() => {
    const unsub = useCosmosStore.getState().initEventListener()
    return unsub
  }, [])

  return (
    <div className="w-screen h-screen overflow-hidden bg-panel flex flex-col">
      <div
        className="relative z-50 h-8 shrink-0 flex items-center justify-center bg-tab-bar border-b border-border"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {repoName && (
          <span className="text-sm font-medium text-fg-muted">{repoName}</span>
        )}
        <div
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setAssistantMenuOpen((open) => !open)}
            aria-label="Assistant"
            aria-expanded={assistantMenuOpen}
            className="flex h-6 min-w-[126px] items-center justify-between gap-2 rounded border border-border bg-panel px-2 text-xs font-medium text-fg outline-none transition-colors hover:border-fg-subtle focus:border-accent"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-fg-muted">
                {assistantIcon(assistant)}
              </span>
              {assistantLabel}
            </span>
            <ChevronDownIcon open={assistantMenuOpen} />
          </button>
          {assistantMenuOpen && (
            <div className="fixed right-3 top-9 z-[100] w-40 rounded border border-border bg-sidebar p-1 shadow-2xl shadow-black/50">
              {visibleAssistantOptions.map((option) => {
                const selected = option.id === assistant
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setAssistant(option.id)
                      setAssistantMenuOpen(false)
                    }}
                    className={[
                      'flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs transition-colors',
                      selected
                        ? 'bg-accent/20 text-fg'
                        : 'text-fg-muted hover:bg-white/5 hover:text-fg',
                    ].join(' ')}
                  >
                    <span className={selected ? 'text-fg' : 'text-fg-subtle'}>
                      {assistantIcon(option.id)}
                    </span>
                    <span className="flex-1">{option.label}</span>
                    {selected && <CheckIcon />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
        <ActivityBar
          side="left"
          groups={[[
            {
              id: 'files',
              icon: <FilesIcon />,
              title: 'Explorer',
              active: leftPanel === 'files',
              onClick: () => setLeftPanel((p) => (p === 'files' ? null : 'files')),
            },
            {
              id: 'git',
              icon: <GitIcon />,
              title: 'Git',
              active: leftPanel === 'git',
              badge: gitBadge,
              onClick: () => setLeftPanel((p) => (p === 'git' ? null : 'git')),
            },
            {
              id: 'todos',
              icon: <TodoIcon />,
              title: 'To Do (Coming Soon)',
              active: leftPanel === 'todos',
              onClick: () => setLeftPanel((p) => (p === 'todos' ? null : 'todos')),
            },
            {
              id: 'mobile',
              icon: <PhoneIcon />,
              title: 'Mobile Display',
              active: leftPanel === 'mobile',
              badge: mobileBadge,
              onClick: () => setLeftPanel((p) => (p === 'mobile' ? null : 'mobile')),
            },
          ]]}
          bottomGroups={[[
            {
              id: 'browser',
              icon: <BrowserIcon />,
              title: 'New Browser Tab',
              active: false,
              disabled: !projectRoot,
              onClick: openNewBrowser,
            },
            {
              id: 'terminal',
              icon: <TerminalIcon />,
              title: 'New Terminal',
              active: false,
              disabled: !projectRoot,
              onClick: openNewTerminal,
            },
            {
              id: 'settings',
              icon: <SettingsIcon />,
              title: 'Settings',
              active: leftPanel === 'settings',
              onClick: () => setLeftPanel((p) => (p === 'settings' ? null : 'settings')),
            },
          ]]}
        />
        <PanelGroup direction="horizontal" className="flex-1">
          {leftPanel && (
            <>
              <Panel
                defaultSize={sidebarSize}
                minSize={SIDEBAR_MIN_SIZE}
                maxSize={SIDEBAR_MAX_SIZE}
                collapsible
                collapsedSize={0}
                onCollapse={() => setLeftPanel(null)}
                id="sidebar"
                order={1}
                onResize={saveSidebarSize}
              >
                {leftPanel === 'files' ? <Sidebar /> : leftPanel === 'git' ? <GitPanel /> : leftPanel === 'todos' ? <TodoPanel /> : leftPanel === 'mobile' ? <MobileDisplayPanel /> : <SettingsPanel />}
              </Panel>
              <PanelResizeHandle className="w-px bg-border hover:bg-accent/60 transition-colors cursor-col-resize" />
            </>
          )}

          <Panel id="center" order={2}>
            <Editor />
          </Panel>

          <PanelResizeHandle className={`w-px bg-border hover:bg-accent/60 transition-colors cursor-col-resize ${chatVisible ? '' : 'hidden'}`} />
          <Panel
            ref={chatPanelRef}
            defaultSize={chatSize}
            minSize={CHAT_MIN_SIZE}
            maxSize={CHAT_MAX_SIZE}
            collapsible
            id="chat"
            order={3}
            onResize={saveChatSize}
          >
            <Chat />
          </Panel>
        </PanelGroup>
        <ActivityBar
          side="right"
          showAccent={false}
          dense
          groups={[
            [{
              id: assistant,
              icon: assistantIcon(assistant),
              title: assistantLabel,
              active: chatVisible,
              onClick: () => useClaudeStore.getState().toggleChatVisible(),
            }],
            [
              {
                id: 'new-session',
                icon: <NewSessionIcon />,
                title: newSessionTitle,
                active: false,
                disabled: !projectRoot,
                onClick: () => {
                  if (!projectRoot) return
                  if (assistant === 'cosmos') useCosmosStore.getState().newSession()
                  else useClaudeStore.getState().newSession(projectRoot)
                },
              },
              {
                id: 'previous-session',
                icon: <PreviousSessionIcon />,
                title: previousSessionTitle,
                active: false,
                disabled: !projectRoot,
                onClick: () => {
                  if (!projectRoot) return
                  if (assistant === 'cosmos') useCosmosStore.getState().openSessionPicker()
                  else useClaudeStore.getState().previousSession(projectRoot)
                },
              },
            ],
            ...(assistant === 'claude' ? [[
              {
                id: 'compact',
                icon: <CompactIcon />,
                title: 'Compact',
                active: false,
                disabled: !projectRoot,
                onClick: () => useClaudeStore.getState().compact(),
              },
              {
                id: 'clear',
                icon: <ClearIcon />,
                title: 'Clear',
                active: false,
                disabled: !projectRoot,
                onClick: () => useClaudeStore.getState().clearContext(),
              },
            ]] : []),
          ]}
          bottomGroups={assistant === 'claude'
            ? [[{
                id: 'usage',
                icon: <UsageIcon />,
                title: 'Usage',
                active: usageOpen,
                disabled: !projectRoot,
                onClick: () => useClaudeStore.getState().usage(),
              }]]
            : assistant === 'codex'
            ? [[
              {
                id: 'model',
                icon: <ModelIcon />,
                title: 'Model',
                active: false,
                disabled: !projectRoot,
                onClick: () => useClaudeStore.getState().model(),
              },
              {
                id: 'fast',
                icon: <FastIcon />,
                title: 'Fast',
                active: false,
                disabled: !projectRoot,
                onClick: () => useClaudeStore.getState().fast(),
              },
            ]]
            : []}
        />
      </div>
      <StatusBar />
      {commandPaletteOpen && projectRoot && (
        <CommandPalette projectRoot={projectRoot} onClose={() => useSearchStore.getState().closeCommandPalette()} />
      )}
      {searchOpen && projectRoot && (
        <SearchModal
          projectRoot={projectRoot}
          caseSensitive={searchCaseSensitive}
          onClose={() => useSearchStore.getState().closeSearch()}
        />
      )}
      {actionPaletteOpen && (
        <ActionPalette onClose={() => useSearchStore.getState().closeActionPalette()} />
      )}
      {shortcutsOverlayOpen && <ShortcutsOverlay />}
    </div>
  )
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={['shrink-0 transition-transform', open ? 'rotate-180' : ''].join(' ')}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="shrink-0 text-accent"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5 12.5L10 17.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
