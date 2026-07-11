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

export class ClaudeManager {
  private procs: Partial<Record<AssistantKind, pty.IPty>> = {}
  private activeAssistant: AssistantKind = 'claude'
  private win: BrowserWindow

  constructor(win: BrowserWindow) {
    this.win = win
  }

  registerHandlers(): void {
    ipcMain.handle('assistant:spawn', (_event, cwd: string, assistant: AssistantKind = 'claude', mode: SessionMode = 'attach') => {
      const selectedAssistant = assistant === 'codex' ? 'codex' : 'claude'
      const selectedMode = mode === 'continue' || mode === 'new' ? mode : 'attach'
      this.activeAssistant = selectedAssistant

      if (selectedMode === 'attach' && this.procs[selectedAssistant]) return

      this.procs[selectedAssistant]?.kill()
      delete this.procs[selectedAssistant]

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
        this.procs[selectedAssistant] = proc
        proc.onData((data) => {
          this.win.webContents.send('assistant:data', selectedAssistant, data)
        })
        proc.onExit(() => {
          if (this.procs[selectedAssistant] === proc) delete this.procs[selectedAssistant]
        })
      } catch {
        this.win.webContents.send(
          'assistant:data',
          selectedAssistant,
          `\r\nError: '${selectedAssistant}' not found in PATH.\r\n${INSTALL_MESSAGES[selectedAssistant]}\r\n`
        )
      }
    })

    ipcMain.on('assistant:write', (_event, assistant: AssistantKind = this.activeAssistant, data: string) => {
      const selectedAssistant = assistant === 'codex' ? 'codex' : 'claude'
      this.procs[selectedAssistant]?.write(data)
    })

    ipcMain.on('assistant:resize', (_event, assistant: AssistantKind = this.activeAssistant, cols: number, rows: number) => {
      if (!hasValidSize(cols, rows)) return

      const selectedAssistant = assistant === 'codex' ? 'codex' : 'claude'
      this.procs[selectedAssistant]?.resize(Math.floor(cols), Math.floor(rows))
    })
  }

  dispose(): void {
    Object.values(this.procs).forEach((proc) => proc?.kill())
    this.procs = {}
  }
}
