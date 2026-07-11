import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useFileStore } from '@/stores/fileStore'
import { useClaudeStore } from '@/stores/claudeStore'

export function Chat() {
  const projectRoot = useFileStore((s) => s.projectRoot)
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

    window.api.claudeSpawn(projectRoot)
    const cleanupData = window.api.onClaudeData((data) => xterm.write(data))
    const onDataDisposable = xterm.onData((data) => window.api.claudeWrite(data))

    const observer = new ResizeObserver(() => {
      fit.fit()
      window.api.claudeResize(xterm.cols, xterm.rows)
    })
    observer.observe(containerRef.current)

    return () => {
      cleanupData()
      onDataDisposable.dispose()
      observer.disconnect()
      xterm.dispose()
      xtermRef.current = null
    }
  }, [projectRoot])

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
            Open a folder to start Claude
          </p>
        </div>
      )}
    </div>
  )
}
