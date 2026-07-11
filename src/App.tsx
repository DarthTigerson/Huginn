import { useEffect, useRef, useState } from 'react'
import { ImperativePanelHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { Terminal } from './components/Terminal/Terminal'
import { Chat } from './components/Chat/Chat'
import {
  ActivityBar,
  FilesIcon,
  SettingsIcon,
  ClaudeIcon,
  CodexIcon,
  NewSessionIcon,
  PreviousSessionIcon,
  CompactIcon,
  ClearIcon,
  UsageIcon,
  ModelIcon,
  FastIcon,
} from './components/ActivityBar/ActivityBar'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { useTerminalStore } from './stores/terminalStore'
import { useFileStore } from './stores/fileStore'
import { useClaudeStore } from './stores/claudeStore'
import type { AssistantKind } from './types/api'

const ASSISTANT_OPTIONS: Array<{ id: AssistantKind; label: string }> = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
]

export default function App() {
  const termVisible = useTerminalStore((s) => s.visible)
  const projectRoot = useFileStore((s) => s.projectRoot)
  const assistant = useClaudeStore((s) => s.assistant)
  const setAssistant = useClaudeStore((s) => s.setAssistant)
  const repoName = projectRoot ? projectRoot.split('/').pop() : null
  const [leftPanel, setLeftPanel] = useState<'files' | 'settings' | null>('files')
  const [chatVisible, setChatVisible] = useState(true)
  const [assistantMenuOpen, setAssistantMenuOpen] = useState(false)
  const chatPanelRef = useRef<ImperativePanelHandle>(null)
  const assistantLabel = assistant === 'claude' ? 'Claude Code' : 'Codex'
  const newSessionTitle = assistant === 'claude' ? 'New Claude Session' : 'New Codex Session'
  const previousSessionTitle = assistant === 'claude' ? 'Continue Claude Session' : 'Resume Latest Codex Session'

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
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault()
        useTerminalStore.getState().toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    useFileStore.getState().restoreRoot()
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
                {assistant === 'claude' ? <ClaudeIcon /> : <CodexIcon />}
              </span>
              {assistantLabel}
            </span>
            <ChevronDownIcon open={assistantMenuOpen} />
          </button>
          {assistantMenuOpen && (
            <div className="fixed right-3 top-9 z-[100] w-40 rounded border border-border bg-sidebar p-1 shadow-2xl shadow-black/50">
              {ASSISTANT_OPTIONS.map((option) => {
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
                      {option.id === 'claude' ? <ClaudeIcon /> : <CodexIcon />}
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
          groups={[[{
            id: 'files',
            icon: <FilesIcon />,
            title: 'Explorer',
            active: leftPanel === 'files',
            onClick: () => setLeftPanel((p) => (p === 'files' ? null : 'files')),
          }]]}
          bottomGroups={[[{
            id: 'settings',
            icon: <SettingsIcon />,
            title: 'Settings',
            active: leftPanel === 'settings',
            onClick: () => setLeftPanel((p) => (p === 'settings' ? null : 'settings')),
          }]]}
        />
        <PanelGroup direction="horizontal" className="flex-1">
          {leftPanel && (
            <>
              <Panel defaultSize={20} minSize={12} maxSize={40} id="sidebar" order={1}>
                {leftPanel === 'files' ? <Sidebar /> : <SettingsPanel />}
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
          dense
          groups={[
            [{
              id: assistant,
              icon: assistant === 'claude' ? <ClaudeIcon /> : <CodexIcon />,
              title: assistantLabel,
              active: chatVisible,
              onClick: () => setChatVisible((v) => !v),
            }],
            [
              {
                id: 'new-session',
                icon: <NewSessionIcon />,
                title: newSessionTitle,
                active: false,
                disabled: !projectRoot,
                onClick: () => projectRoot && useClaudeStore.getState().newSession(projectRoot),
              },
              {
                id: 'previous-session',
                icon: <PreviousSessionIcon />,
                title: previousSessionTitle,
                active: false,
                disabled: !projectRoot,
                onClick: () => projectRoot && useClaudeStore.getState().previousSession(projectRoot),
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
                active: false,
                disabled: !projectRoot,
                onClick: () => useClaudeStore.getState().usage(),
              }]]
            : [[
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
            ]]}
        />
      </div>
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
