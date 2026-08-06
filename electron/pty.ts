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
  private procs = new Map<string, pty.IPty>()
  private killedIds = new Set<string>() // tracks intentional kills
  private win: BrowserWindow

  constructor(win: BrowserWindow) {
    this.win = win
  }

  registerHandlers(): void {
    ipcMain.handle('term:spawn', (_event, id: string, cwd?: string) => {
      if (this.procs.has(id)) return
      // Electron's own process env sometimes carries an EDITOR/VISUAL set by
      // whatever dev tooling launched it (e.g. "vi"), not by the user's shell
      // profile. zsh auto-switches its line editor into vi mode whenever
      // $VISUAL/$EDITOR ends in "vi", which silently drops the emacs-style
      // bindings readline users expect (Ctrl+R history search, Ctrl+A/E
      // line navigation — Ctrl+C still works since SIGINT is a TTY signal,
      // not a keymap binding). Stripping these lets the shell fall back to
      // its normal interactive default instead of inheriting Electron's.
      const env = { ...(process.env as Record<string, string>) }
      delete env.EDITOR
      delete env.VISUAL
      const proc = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: cwd ?? process.env.HOME,
        env,
      })
      this.procs.set(id, proc)
      proc.onData((data) => {
        this.win.webContents.send('term:data', id, data)
      })
      proc.onExit(() => {
        if (this.killedIds.has(id)) {
          this.killedIds.delete(id) // intentional kill — no notification
          return
        }
        this.procs.delete(id)
        this.win.webContents.send('term:exit', id)
      })
    })

    ipcMain.handle('term:kill', (_event, id: string) => {
      const proc = this.procs.get(id)
      if (!proc) return
      this.killedIds.add(id) // mark as intentional before kill fires onExit
      this.procs.delete(id)
      proc.kill()
    })

    ipcMain.on('term:write', (_event, id: string, data: string) => {
      this.procs.get(id)?.write(data)
    })

    ipcMain.on('term:resize', (_event, id: string, cols: number, rows: number) => {
      if (!hasValidSize(cols, rows)) return
      this.procs.get(id)?.resize(Math.floor(cols), Math.floor(rows))
    })
  }

  dispose(): void {
    for (const proc of this.procs.values()) proc.kill()
    this.procs.clear()
    this.killedIds.clear()
  }
}
