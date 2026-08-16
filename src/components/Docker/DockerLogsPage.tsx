import { useEffect, useRef, useState } from 'react'
import { useDockerStore } from '@/stores/dockerStore'
import { parseDockerLogsPath } from './paths'

const POLL_INTERVAL_MS = 5000

function useDockerLogs(containerId: string) {
  const [lines, setLines] = useState('')
  const streamIdRef = useRef<string | null>(null)

  useEffect(() => {
    setLines('')
    const streamId = `docker-logs-${containerId}-${Date.now().toString(36)}`
    streamIdRef.current = streamId
    window.api.dockerRunLogs(streamId, containerId)

    const offData = window.api.onDockerLogData((id, data) => {
      if (id === streamId) setLines((prev) => prev + data)
    })
    const offExit = window.api.onDockerLogExit((id) => {
      if (id === streamId) streamIdRef.current = null
    })

    return () => {
      offData()
      offExit()
      if (streamIdRef.current) window.api.dockerStopLogs(streamIdRef.current)
    }
  }, [containerId])

  return lines
}

export function DockerLogsPage({ path }: { path: string }) {
  const { containerId, containerName } = parseDockerLogsPath(path)
  const containers = useDockerStore((s) => s.containers)
  const refresh = useDockerStore((s) => s.refresh)
  const startWatching = useDockerStore((s) => s.startWatching)
  const stopWatching = useDockerStore((s) => s.stopWatching)
  const startContainer = useDockerStore((s) => s.startContainer)
  const stopContainer = useDockerStore((s) => s.stopContainer)
  const restartContainer = useDockerStore((s) => s.restartContainer)
  const lines = useDockerLogs(containerId)

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

  const container = containers.find((c) => c.id === containerId)
  const running = container?.state === 'running'

  const btnClass =
    'px-2 py-1 text-xs rounded border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors'

  return (
    <div className="h-full flex flex-col bg-panel">
      <div className="p-6 pb-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-fg mb-1 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${running ? 'bg-green-400' : 'bg-fg-subtle'}`} />
              {containerName}
            </h1>
            <p className="text-sm text-fg-muted">{container?.status ?? 'Container not found — it may have been removed.'}</p>
          </div>
          {container && (
            <div className="flex items-center gap-1.5">
              {running ? (
                <button type="button" className={btnClass} onClick={() => stopContainer(containerId)}>Stop</button>
              ) : (
                <button type="button" className={btnClass} onClick={() => startContainer(containerId)}>Start</button>
              )}
              <button type="button" className={btnClass} onClick={() => restartContainer(containerId)}>Restart</button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 px-6 pb-6">
        <pre className="h-full overflow-auto whitespace-pre-wrap break-all bg-black/30 text-xs text-fg-muted font-mono p-3 rounded-lg border border-border/60">
          {lines || 'Waiting for output…'}
        </pre>
      </div>
    </div>
  )
}
