import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '@/stores/terminalStore'

function hasValidSize(cols: number, rows: number): boolean {
  return cols > 0 && rows > 0
}

export function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const hide = useTerminalStore((s) => s.hide)

  useEffect(() => {
    if (!containerRef.current || xtermRef.current) return

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
    fitRef.current = fit

    window.api.termSpawn()
    const cleanupData = window.api.onTermData((data) => xterm.write(data))
    xterm.onData((data) => window.api.termWrite(data))

    const observer = new ResizeObserver(() => {
      fit.fit()
      if (hasValidSize(xterm.cols, xterm.rows)) {
        window.api.termResize(xterm.cols, xterm.rows)
      }
    })
    observer.observe(containerRef.current)

    return () => {
      cleanupData()
      observer.disconnect()
      xterm.dispose()
      xtermRef.current = null
    }
  }, [])

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] border-t border-border overflow-hidden">
      <div className="flex items-center px-3 h-7 border-b border-border shrink-0 bg-tab-bar">
        <span className="text-xs text-gray-400 font-medium">Terminal</span>
        <button
          className="ml-auto text-gray-500 hover:text-gray-300 text-sm leading-none transition-colors"
          onClick={hide}
        >
          ✕
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden p-1" />
    </div>
  )
}
