import { BrowserWindow, ipcMain } from 'electron'
import * as pty from 'node-pty'

type AssistantKind = 'claude' | 'codex'
type SessionMode = 'attach' | 'new' | 'continue'

const COMMANDS: Record<AssistantKind, Record<Exclude<SessionMode, 'attach'>, string>> = {
  claude: {
    new: 'claude',
    continue: 'claude --continue',
  },
  codex: {
    new: 'codex',
    continue: 'codex resume --last',
  },
}

const INSTALL_MESSAGES: Record<AssistantKind, string> = {
  claude: "Install it with: npm install -g @anthropic-ai/claude-code",
  codex: 'Install Codex CLI, then make sure `codex` is available in PATH.',
}

function hasValidSize(cols: number, rows: number): boolean {
  return Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0
}

interface WindowState {
  procs: Partial<Record<AssistantKind, pty.IPty>>
  procCwd: Partial<Record<AssistantKind, string>>
  activeAssistant: AssistantKind
}

export class ClaudeManager {
  private byWindow = new Map<number, WindowState>()

  registerHandlers(): void {
    ipcMain.handle('assistant:spawn', (event, cwd: string, assistant: AssistantKind = 'claude', mode: SessionMode = 'attach') => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      const state = this.stateFor(win.id)
      const selectedAssistant = assistant === 'codex' ? 'codex' : 'claude'
      const selectedMode = mode === 'continue' || mode === 'new' ? mode : 'attach'
      state.activeAssistant = selectedAssistant

      const attachingToSameCwd = state.procs[selectedAssistant] && state.procCwd[selectedAssistant] === cwd
      if (selectedMode === 'attach' && attachingToSameCwd) return

      state.procs[selectedAssistant]?.kill()
      delete state.procs[selectedAssistant]
      delete state.procCwd[selectedAssistant]

      try {
        const shell = process.env.SHELL ?? '/bin/zsh'
        const command = COMMANDS[selectedAssistant][selectedMode === 'attach' ? 'new' : selectedMode]
        const proc = pty.spawn(shell, ['-lic', command], {
          name: 'xterm-color',
          cols: 80,
          rows: 24,
          cwd,
          env: process.env as Record<string, string>,
        })
        state.procs[selectedAssistant] = proc
        state.procCwd[selectedAssistant] = cwd
        proc.onData((data) => {
          if (!win.isDestroyed()) win.webContents.send('assistant:data', selectedAssistant, data)
        })
        proc.onExit(() => {
          if (state.procs[selectedAssistant] === proc) {
            delete state.procs[selectedAssistant]
            delete state.procCwd[selectedAssistant]
          }
        })
      } catch {
        if (!win.isDestroyed()) {
          win.webContents.send(
            'assistant:data',
            selectedAssistant,
            `\r\nError: '${selectedAssistant}' not found in PATH.\r\n${INSTALL_MESSAGES[selectedAssistant]}\r\n`
          )
        }
      }
    })

    ipcMain.on('assistant:write', (event, assistant: AssistantKind | undefined, data: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      const state = this.stateFor(win.id)
      const selectedAssistant = (assistant === 'codex' ? 'codex' : assistant === 'claude' ? 'claude' : state.activeAssistant)
      state.procs[selectedAssistant]?.write(data)
    })

    ipcMain.on('assistant:resize', (event, assistant: AssistantKind | undefined, cols: number, rows: number) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win || !hasValidSize(cols, rows)) return
      const state = this.stateFor(win.id)
      const selectedAssistant = (assistant === 'codex' ? 'codex' : assistant === 'claude' ? 'claude' : state.activeAssistant)
      state.procs[selectedAssistant]?.resize(Math.floor(cols), Math.floor(rows))
    })
  }

  private stateFor(winId: number): WindowState {
    let state = this.byWindow.get(winId)
    if (!state) {
      state = { procs: {}, procCwd: {}, activeAssistant: 'claude' }
      this.byWindow.set(winId, state)
    }
    return state
  }

  disposeWindow(winId: number): void {
    const state = this.byWindow.get(winId)
    if (!state) return
    Object.values(state.procs).forEach((proc) => proc?.kill())
    this.byWindow.delete(winId)
  }
}
