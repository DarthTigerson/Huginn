import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '@/stores/terminalStore'
import { useThemeStore, XTERM_THEMES } from '@/stores/themeStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useDisplayStore } from '@/stores/displayStore'

function hasValidSize(cols: number, rows: number): boolean {
  return cols > 0 && rows > 0
}

export function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const hide = useTerminalStore((s) => s.hide)
  const theme = useThemeStore((s) => s.theme)
  const fontSize = useFontSizeStore((s) => s.fontSize)
  const font = useDisplayStore((s) => s.font)

  useEffect(() => {
    if (!containerRef.current || xtermRef.current) return

    const xterm = new XTerm({
      theme: XTERM_THEMES[useThemeStore.getState().theme],
      fontFamily: useDisplayStore.getState().font,
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

  useEffect(() => {
    if (!xtermRef.current) return
    xtermRef.current.options.theme = XTERM_THEMES[theme]
  }, [theme])

  useEffect(() => {
    if (!xtermRef.current) return
    xtermRef.current.options.fontSize = fontSize
    fitRef.current?.fit()
  }, [fontSize])

  useEffect(() => {
    if (!xtermRef.current) return
    xtermRef.current.options.fontFamily = font
    fitRef.current?.fit()
  }, [font])

  return (
    <div className="h-full flex flex-col bg-bg border-t border-border overflow-hidden">
      <div className="flex items-center px-3 h-7 border-b border-border shrink-0 bg-tab-bar">
        <span className="text-xs text-fg-muted font-medium">Terminal</span>
        <button
          className="ml-auto text-fg-muted hover:text-fg text-sm leading-none transition-colors"
          onClick={hide}
        >
          ✕
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden p-1" />
    </div>
  )
}
