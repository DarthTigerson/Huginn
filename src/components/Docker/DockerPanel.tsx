import { useEffect, useState } from 'react'
import { useDockerStore } from '@/stores/dockerStore'
import { useEditorStore } from '@/stores/editorStore'
import { buildDockerLogsPath } from './paths'
import { ConfirmRemoveContainerModal } from './ConfirmRemoveContainerModal'
import type { DockerContainer } from '@/types/api'

const POLL_INTERVAL_MS = 5000

const STATUS_LABEL: Record<string, string> = {
  unknown: 'Checking…',
  'not-installed': 'Docker not installed',
  stopped: 'Docker not running',
  running: 'Docker running',
}

const STATUS_DOT: Record<string, string> = {
  unknown: 'bg-fg-subtle',
  'not-installed': 'bg-fg-subtle',
  stopped: 'bg-red-400',
  running: 'bg-green-400',
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l14 8-14 8V4Z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="5" width="14" height="14" rx="1.5" />
    </svg>
  )
}

function RestartIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconButton({ onClick, label, danger, children }: {
  onClick: () => void
  label: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        'w-5 h-5 flex items-center justify-center rounded transition-colors',
        danger ? 'text-red-400 hover:bg-red-500/10' : 'text-fg-muted hover:text-fg hover:bg-white/5',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function ContainerRow({ container, onRequestRemove }: {
  container: DockerContainer
  onRequestRemove: (container: DockerContainer) => void
}) {
  const startContainer = useDockerStore((s) => s.startContainer)
  const stopContainer = useDockerStore((s) => s.stopContainer)
  const restartContainer = useDockerStore((s) => s.restartContainer)
  const running = container.state === 'running'

  function openLogs() {
    useEditorStore.getState().openTab({
      path: buildDockerLogsPath(container.id, container.name),
      content: '',
      dirty: false,
    })
  }

  return (
    <li className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={openLogs} className="flex items-center gap-2 min-w-0 flex-1 text-left">
          <span className={`w-2 h-2 rounded-full shrink-0 ${running ? 'bg-green-400' : 'bg-fg-subtle'}`} />
          <span className="text-xs font-medium text-fg truncate">{container.name}</span>
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          {running ? (
            <IconButton onClick={() => stopContainer(container.id)} label="Stop"><StopIcon /></IconButton>
          ) : (
            <IconButton onClick={() => startContainer(container.id)} label="Start"><PlayIcon /></IconButton>
          )}
          <IconButton onClick={() => restartContainer(container.id)} label="Restart"><RestartIcon /></IconButton>
          <IconButton onClick={() => onRequestRemove(container)} label="Remove" danger>✕</IconButton>
        </div>
      </div>
      <span className="text-[0.625rem] text-fg-muted pl-4 truncate">{container.status}</span>
    </li>
  )
}

export function DockerPanel() {
  const status = useDockerStore((s) => s.status)
  const containers = useDockerStore((s) => s.containers)
  const refresh = useDockerStore((s) => s.refresh)
  const startWatching = useDockerStore((s) => s.startWatching)
  const stopWatching = useDockerStore((s) => s.stopWatching)
  const openApp = useDockerStore((s) => s.openApp)
  const [removeTarget, setRemoveTarget] = useState<DockerContainer | null>(null)

  useEffect(() => {
    refresh()
    startWatching()
    const offChanged = window.api.onDockerChanged(() => refresh())
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      refresh()
    }, POLL_INTERVAL_MS)
    return () => {
      offChanged()
      clearInterval(interval)
      stopWatching()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="h-9 px-3 border-b border-border shrink-0 flex items-center justify-between">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Docker</span>
        <button
          type="button"
          onClick={() => refresh()}
          aria-label="Refresh"
          title="Refresh"
          className="text-fg-muted hover:text-fg transition-colors"
        >
          <RefreshIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
            <span className="text-xs font-medium text-fg">{STATUS_LABEL[status] ?? status}</span>
          </div>
          {status === 'stopped' && (
            <button type="button" onClick={() => openApp()} className="text-xs text-accent hover:opacity-80 transition-opacity">
              Start Docker
            </button>
          )}
        </div>

        {status === 'not-installed' && (
          <p className="text-xs text-fg-muted text-center leading-relaxed pt-2">
            Install Docker to see and control containers here.
          </p>
        )}
        {status === 'running' && containers.length === 0 && (
          <p className="text-xs text-fg-muted text-center leading-relaxed pt-2">No containers found.</p>
        )}
        {status === 'running' && containers.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {containers.map((container) => (
              <ContainerRow key={container.id} container={container} onRequestRemove={setRemoveTarget} />
            ))}
          </ul>
        )}
      </div>

      {removeTarget && (
        <ConfirmRemoveContainerModal container={removeTarget} onClose={() => setRemoveTarget(null)} />
      )}
    </div>
  )
}
