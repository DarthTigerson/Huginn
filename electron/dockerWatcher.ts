import { BrowserWindow, ipcMain } from 'electron'
import { spawn, type ChildProcessByStdio } from 'child_process'
import type { Readable } from 'stream'
import { resolveBinaryPath } from './lsp/shellPath'

type DockerEventsProc = ChildProcessByStdio<null, Readable, Readable>

// Docker's state is global to the machine, not per-window/per-repo like
// git — so unlike GitWatcher, this runs a single `docker events` stream
// shared by every window that's asked to watch, rather than one watcher
// per window. Any container/daemon state change broadcasts to all windows.
export class DockerWatcher {
  private proc: DockerEventsProc | null = null
  private watchingWindows = new Set<number>()
  // Resolving the binary path is async, so a second docker:watch firing
  // before the first resolution lands could otherwise spawn a duplicate
  // stream — this flag closes that race.
  private starting = false

  registerHandlers(): void {
    ipcMain.on('docker:watch', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      this.watchingWindows.add(win.id)
      void this.ensureRunning()
    })

    ipcMain.on('docker:unwatch', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      this.watchingWindows.delete(win.id)
      if (this.watchingWindows.size === 0) this.stop()
    })
  }

  private async ensureRunning(): Promise<void> {
    if (this.proc || this.starting) return
    this.starting = true
    // See dockerBin() in docker.ts: Electron GUI launches don't inherit the
    // shell's PATH, so the bare 'docker' name can fail to resolve even when
    // Docker Desktop is installed and running.
    const bin = (await resolveBinaryPath('docker')) ?? 'docker'
    this.starting = false
    if (this.proc || this.watchingWindows.size === 0) return
    const proc = spawn(bin, ['events', '--format', '{{json .}}'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.proc = proc
    proc.stdout.on('data', () => this.notifyChanged())
    // If `docker events` dies (daemon stopped, docker uninstalled), we don't
    // try to reconnect it — the renderer's poll fallback covers staleness in
    // the meantime, and the next docker:watch call (e.g. popover reopened)
    // will spawn a fresh one anyway.
    proc.on('close', () => { this.proc = null })
    proc.on('error', () => { this.proc = null })
  }

  private notifyChanged(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('docker:changed')
    }
  }

  private stop(): void {
    this.proc?.kill()
    this.proc = null
  }

  disposeWindow(winId: number): void {
    this.watchingWindows.delete(winId)
    if (this.watchingWindows.size === 0) this.stop()
  }
}
