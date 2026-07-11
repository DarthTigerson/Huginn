import { BrowserWindow, ipcMain } from 'electron'
import * as pty from 'node-pty'
import { platform } from 'os'

const shell =
  platform() === 'win32'
    ? 'powershell.exe'
    : process.env.SHELL ?? '/bin/zsh'

function hasValidSize(cols: number, rows: number): boolean {
  return Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0
}

export class PtyManager {
  private proc: pty.IPty | null = null
  private win: BrowserWindow

  constructor(win: BrowserWindow) {
    this.win = win
  }

  registerHandlers(): void {
    ipcMain.handle('term:spawn', () => {
      if (this.proc) return
      this.proc = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
        env: process.env as Record<string, string>,
      })
      this.proc.onData((data) => {
        this.win.webContents.send('term:data', data)
      })
      this.proc.onExit(() => {
        this.proc = null
      })
    })

    ipcMain.on('term:write', (_event, data: string) => {
      this.proc?.write(data)
    })

    ipcMain.on('term:resize', (_event, cols: number, rows: number) => {
      if (!hasValidSize(cols, rows)) return

      this.proc?.resize(Math.floor(cols), Math.floor(rows))
    })
  }

  dispose(): void {
    this.proc?.kill()
    this.proc = null
  }
}
