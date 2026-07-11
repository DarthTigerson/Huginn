import { BrowserWindow, ipcMain } from 'electron'
import * as pty from 'node-pty'

export class ClaudeManager {
  private proc: pty.IPty | null = null
  private win: BrowserWindow

  constructor(win: BrowserWindow) {
    this.win = win
  }

  registerHandlers(): void {
    ipcMain.handle('claude:spawn', (_event, cwd: string, mode: 'new' | 'continue' = 'new') => {
      this.proc?.kill()
      this.proc = null
      try {
        const shell = process.env.SHELL ?? '/bin/zsh'
        const command = mode === 'continue' ? 'claude --continue' : 'claude'
        this.proc = pty.spawn(shell, ['-lic', command], {
          name: 'xterm-color',
          cols: 80,
          rows: 24,
          cwd,
          env: process.env as Record<string, string>,
        })
        this.proc.onData((data) => {
          this.win.webContents.send('claude:data', data)
        })
        this.proc.onExit(() => {
          this.proc = null
        })
      } catch {
        this.win.webContents.send(
          'claude:data',
          "\r\nError: 'claude' not found in PATH.\r\nInstall it with: npm install -g @anthropic-ai/claude-code\r\n"
        )
      }
    })

    ipcMain.on('claude:write', (_event, data: string) => {
      this.proc?.write(data)
    })

    ipcMain.on('claude:resize', (_event, cols: number, rows: number) => {
      this.proc?.resize(cols, rows)
    })
  }

  dispose(): void {
    this.proc?.kill()
    this.proc = null
  }
}
