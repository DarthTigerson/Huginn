import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useFileStore } from '@/stores/fileStore'
import { useClaudeStore } from '@/stores/claudeStore'
import { useThemeStore, XTERM_THEMES, type ThemeId } from '@/stores/themeStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useDisplayStore } from '@/stores/displayStore'
import { CosmosChat } from './CosmosChat'
import { isShiftEnterKeydown, SHIFT_ENTER_SEQUENCE } from './shiftEnterSequence'
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
    fontFamily: useDisplayStore.getState().font,
    fontSize: useFontSizeStore.getState().fontSize,
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
  const font = useDisplayStore((s) => s.font)
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalsRef = useRef<Partial<Record<AssistantKind, AssistantTerminal>>>({})
  const activeAssistantRef = useRef<AssistantKind>(assistant)
  const isFirstRestart = useRef(true)

  useEffect(() => {
    activeAssistantRef.current = assistant
  }, [assistant])

  useEffect(() => {
    if (!projectRoot || !containerRef.current || assistant === 'cosmos') return

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

      if (kind === 'claude') {
        // xterm sends the same CR byte for Enter and Shift+Enter by default, which
        // Claude Code's CLI reads as "submit" either way. Send the ESC+CR sequence
        // it expects for "insert newline" instead of falling through to xterm's
        // default Enter handling.
        //
        // Returning false here short-circuits xterm's own _keyDown before it ever
        // calls cancel() (its preventDefault/stopPropagation), so without calling
        // preventDefault ourselves the browser still runs Enter's default action —
        // inserting a newline into xterm's hidden textarea — which xterm's input
        // handler then forwards to the PTY as a stray extra keystroke right behind
        // our escape sequence, submitting the message anyway.
        xterm.attachCustomKeyEventHandler((event) => {
          if (!isShiftEnterKeydown(event)) return true
          event.preventDefault()
          window.api.assistantWrite(kind, SHIFT_ENTER_SEQUENCE)
          return false
        })
      }

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
    Object.values(terminalsRef.current).forEach((terminal) => {
      terminal.xterm.options.fontFamily = font
      terminal.fit.fit()
    })
  }, [font])

  useEffect(() => {
    if (!projectRoot || !containerRef.current) return

    const observer = new ResizeObserver(() => {
      const activeAssistant = activeAssistantRef.current
      if (activeAssistant === 'cosmos') return
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
    const terminal = terminalsRef.current[activeAssistantRef.current]
    if (!terminal) return
    terminal.xterm.clear()
    // A restart ("New Session" / "Continue Session") spawns a brand-new PTY on
    // the main-process side, which node-pty always creates at its 80x24
    // default — nothing there knows this pane's actual size. The xterm
    // instance itself is untouched by a restart though, so it already holds
    // the correct, previously-fitted cols/rows; just relay those to the new
    // PTY instead of leaving it stuck at 80x24 until the panel is manually
    // resized.
    if (hasValidSize(terminal.xterm.cols, terminal.xterm.rows)) {
      window.api.assistantResize(activeAssistantRef.current, terminal.xterm.cols, terminal.xterm.rows)
    }
  }, [restartToken])

  return (
    <div className="h-full flex flex-col bg-bg border-l border-border overflow-hidden">
      {projectRoot ? (
        <>
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden p-1"
            style={{ display: assistant === 'cosmos' ? 'none' : 'block' }}
          />
          {assistant === 'cosmos' && (
            <div className="flex-1 overflow-hidden">
              <CosmosChat cwd={projectRoot} />
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-xs text-fg-muted text-center leading-relaxed">
            Open a folder to start {assistant === 'claude' ? 'Claude Code' : assistant === 'codex' ? 'Codex' : 'Cosmos'}
          </p>
        </div>
      )}
    </div>
  )
}
