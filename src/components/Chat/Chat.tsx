import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useFileStore } from '@/stores/fileStore'
import { useClaudeStore } from '@/stores/claudeStore'
import { useThemeStore, XTERM_THEMES, type ThemeId } from '@/stores/themeStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import type { AssistantKind } from '@/types/api'

function hasValidSize(cols: number, rows: number): boolean {
  return cols > 0 && rows > 0
}

interface AssistantTerminal {
  host: HTMLDivElement
  xterm: XTerm
  fit: FitAddon
  cleanupData: () => void
  onDataDisposable: { dispose: () => void }
}

const ASSISTANTS: AssistantKind[] = ['claude', 'codex']

function createXTerm(themeId: ThemeId): XTerm {
  return new XTerm({
    theme: XTERM_THEMES[themeId],
    fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace',
    fontSize: 13,
    cursorBlink: true,
    convertEol: true,
  })
}

export function Chat() {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const assistant = useClaudeStore((s) => s.assistant)
  const restartToken = useClaudeStore((s) => s.restartToken)
  const theme = useThemeStore((s) => s.theme)
  const fontSize = useFontSizeStore((s) => s.fontSize)
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalsRef = useRef<Partial<Record<AssistantKind, AssistantTerminal>>>({})
  const activeAssistantRef = useRef<AssistantKind>(assistant)
  const isFirstRestart = useRef(true)

  useEffect(() => {
    activeAssistantRef.current = assistant
  }, [assistant])

  useEffect(() => {
    if (!projectRoot || !containerRef.current) return

    const container = containerRef.current

    const ensureTerminal = (kind: AssistantKind): AssistantTerminal => {
      const existing = terminalsRef.current[kind]
      if (existing) return existing

      const host = document.createElement('div')
      host.className = 'h-full w-full overflow-hidden'
      host.style.display = kind === assistant ? 'block' : 'none'
      container.appendChild(host)

      const xterm = createXTerm(useThemeStore.getState().theme)
      const fit = new FitAddon()
      xterm.loadAddon(fit)
      xterm.open(host)

      window.api.assistantSpawn(projectRoot, kind)
      const cleanupData = window.api.onAssistantData((source, data) => {
        if (source === kind) xterm.write(data)
      })
      const onDataDisposable = xterm.onData((data) => window.api.assistantWrite(kind, data))

      const terminal = { host, xterm, fit, cleanupData, onDataDisposable }
      terminalsRef.current[kind] = terminal
      return terminal
    }

    ASSISTANTS.forEach((kind) => {
      const terminal = kind === assistant ? ensureTerminal(kind) : terminalsRef.current[kind]
      if (!terminal) return

      terminal.host.style.display = kind === assistant ? 'block' : 'none'
    })

    const activeTerminal = ensureTerminal(assistant)
    requestAnimationFrame(() => {
      activeTerminal.fit.fit()
      if (hasValidSize(activeTerminal.xterm.cols, activeTerminal.xterm.rows)) {
        window.api.assistantResize(assistant, activeTerminal.xterm.cols, activeTerminal.xterm.rows)
      }
    })
  }, [projectRoot, assistant])

  useEffect(() => {
    Object.values(terminalsRef.current).forEach((terminal) => {
      terminal.xterm.options.theme = XTERM_THEMES[theme]
    })
  }, [theme])

  useEffect(() => {
    Object.values(terminalsRef.current).forEach((terminal) => {
      terminal.xterm.options.fontSize = fontSize
      terminal.fit.fit()
    })
  }, [fontSize])

  useEffect(() => {
    if (!projectRoot || !containerRef.current) return

    const observer = new ResizeObserver(() => {
      const activeAssistant = activeAssistantRef.current
      const activeTerminal = terminalsRef.current[activeAssistant]
      if (!activeTerminal) return

      activeTerminal.fit.fit()
      if (hasValidSize(activeTerminal.xterm.cols, activeTerminal.xterm.rows)) {
        window.api.assistantResize(activeAssistant, activeTerminal.xterm.cols, activeTerminal.xterm.rows)
      }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [projectRoot])

  useEffect(() => {
    return () => {
      Object.values(terminalsRef.current).forEach((terminal) => {
        terminal.cleanupData()
        terminal.onDataDisposable.dispose()
        terminal.xterm.dispose()
        terminal.host.remove()
      })
      terminalsRef.current = {}
    }
  }, [projectRoot])

  useEffect(() => {
    if (isFirstRestart.current) {
      isFirstRestart.current = false
      return
    }
    terminalsRef.current[activeAssistantRef.current]?.xterm.clear()
  }, [restartToken])

  return (
    <div className="h-full flex flex-col bg-bg border-l border-border overflow-hidden">
      {projectRoot ? (
        <div ref={containerRef} className="flex-1 overflow-hidden p-1" />
      ) : (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-xs text-fg-muted text-center leading-relaxed">
            Open a folder to start {assistant === 'claude' ? 'Claude Code' : 'Codex'}
          </p>
        </div>
      )}
    </div>
  )
}
