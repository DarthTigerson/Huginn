import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useFileStore } from '@/stores/fileStore'
import { useClaudeStore } from '@/stores/claudeStore'

function hasValidSize(cols: number, rows: number): boolean {
  return cols > 0 && rows > 0
}

export function Chat() {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const assistant = useClaudeStore((s) => s.assistant)
  const restartToken = useClaudeStore((s) => s.restartToken)
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const spawnedRef = useRef(false)
  const isFirstRestart = useRef(true)

  useEffect(() => {
    if (!projectRoot || !containerRef.current || spawnedRef.current) return
    spawnedRef.current = true

    const xterm = new XTerm({
      theme: {
        background: '#1a1a1a',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
      },
      fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
    })

    const fit = new FitAddon()
    xterm.loadAddon(fit)
    xterm.open(containerRef.current)
    fit.fit()
    xtermRef.current = xterm

    window.api.assistantSpawn(projectRoot, assistant)
    const cleanupData = window.api.onAssistantData((source, data) => {
      if (source === assistant) xterm.write(data)
    })
    const onDataDisposable = xterm.onData((data) => window.api.assistantWrite(assistant, data))

    const observer = new ResizeObserver(() => {
      fit.fit()
      if (hasValidSize(xterm.cols, xterm.rows)) {
        window.api.assistantResize(assistant, xterm.cols, xterm.rows)
      }
    })
    observer.observe(containerRef.current)

    return () => {
      cleanupData()
      onDataDisposable.dispose()
      observer.disconnect()
      xterm.dispose()
      xtermRef.current = null
      spawnedRef.current = false
    }
  }, [projectRoot, assistant])

  useEffect(() => {
    if (isFirstRestart.current) {
      isFirstRestart.current = false
      return
    }
    xtermRef.current?.clear()
  }, [restartToken])

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] border-l border-border overflow-hidden">
      {projectRoot ? (
        <div ref={containerRef} className="flex-1 overflow-hidden p-1" />
      ) : (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            Open a folder to start {assistant === 'claude' ? 'Claude Code' : 'Codex'}
          </p>
        </div>
      )}
    </div>
  )
}
