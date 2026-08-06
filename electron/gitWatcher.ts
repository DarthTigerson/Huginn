import { BrowserWindow, ipcMain } from 'electron'
import { watch, type FSWatcher } from 'chokidar'
import { existsSync } from 'fs'
import { join } from 'path'

// Renderer only learns about git state changes it caused itself (staging,
// committing, etc. through the UI) or on window focus. Commands run directly
// in the integrated terminal (checkout, commit, pull, merge...) never trigger
// either path, so the status bar goes stale. Watching the handful of files
// git itself mutates on any state change lets us push a refresh regardless of
// where the command came from.
export class GitWatcher {
  private watcher: FSWatcher | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private cwd: string | null = null
  private win: BrowserWindow

  constructor(win: BrowserWindow) {
    this.win = win
  }

  registerHandlers(): void {
    ipcMain.on('git:watchRoot', (_event, cwd: string | null) => {
      if (cwd) this.watchRoot(cwd)
      else this.stop()
    })
  }

  private watchRoot(cwd: string): void {
    if (this.cwd === cwd && this.watcher) return
    this.stop()

    const gitDir = join(cwd, '.git')
    if (!existsSync(gitDir)) return

    this.cwd = cwd
    this.watcher = watch(
      [
        join(gitDir, 'HEAD'),
        join(gitDir, 'MERGE_HEAD'),
        join(gitDir, 'index'),
        join(gitDir, 'packed-refs'),
        join(gitDir, 'refs'),
      ],
      { ignoreInitial: true, depth: 5 }
    )
    this.watcher.on('all', () => this.notifyChanged(cwd))
    this.watcher.on('error', (err) => console.error('GitWatcher error:', err))
  }

  private notifyChanged(cwd: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.win.webContents.send('git:changed', cwd)
    }, 300)
  }

  private stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.watcher?.close()
    this.watcher = null
    this.cwd = null
  }

  dispose(): void {
    this.stop()
  }
}
