import { ipcMain, BrowserWindow } from 'electron'
import { spawn, execFile } from 'child_process'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import type { GraphifyGraph } from '../src/types/graphify'

const NOT_INSTALLED_MESSAGE =
  "Error: 'graphify' not found in PATH.\r\nInstall it with: uv tool install graphifyy && graphify install\r\n"

// Electron-launched apps (Finder/Dock, not `npm run dev` from a terminal)
// don't inherit the interactive shell's PATH, so a bare spawn('graphify', ...)
// fails whenever the CLI lives outside the default system PATH (e.g.
// installed via `uv tool install graphifyy`, which places binaries in
// ~/.local/bin). Mirrors resolveClaudePath() in electron/autocomplete.ts:
// resolve the absolute path once via a login shell and cache it. Falls back
// to the bare command name (not null) on failure so downstream spawn() calls
// still produce a sensible ENOENT/"not installed" error rather than silently
// no-op'ing.
let cachedGraphifyPath: string | null | undefined
// Caches the in-flight resolution promise so concurrent callers (e.g. the
// registerHandlers() prewarm below racing an early checkAvailable() call)
// share a single login-shell resolution instead of spawning their own.
let pendingGraphifyPathResolution: Promise<string | null> | undefined

export function resolveGraphifyPath(): Promise<string | null> {
  if (cachedGraphifyPath !== undefined) return Promise.resolve(cachedGraphifyPath)
  if (pendingGraphifyPathResolution) return pendingGraphifyPathResolution

  pendingGraphifyPathResolution = new Promise<string | null>((resolve) => {
    const shell = process.env.SHELL ?? '/bin/zsh'
    execFile(shell, ['-lic', 'command -v graphify'], (err, stdout) => {
      // `-lic` runs an interactive login shell, which sources .zshrc/.zprofile
      // and can prepend banners or version-manager output (nvm, pyenv, ...) to
      // stdout. Take the last non-empty line rather than the whole trimmed
      // output, and require it to look like an absolute path.
      const lines = (stdout ? stdout.toString() : '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
      const lastLine = lines[lines.length - 1]
      const resolved = !err && lastLine && lastLine.startsWith('/') ? lastLine : null

      if (resolved) {
        // Only cache successes — caching a failure would silently disable the
        // absolute-path resolution for the rest of the app session on a
        // transient hiccup (shell not ready yet, PATH not sourced yet, etc.).
        cachedGraphifyPath = resolved
        resolve(resolved)
        return
      }

      console.error('[graphify] failed to resolve graphify CLI path via login shell:', err ?? `unexpected output: ${JSON.stringify(stdout)}`)
      resolve(null)
    })
  })

  pendingGraphifyPathResolution.finally(() => {
    pendingGraphifyPathResolution = undefined
  })

  return pendingGraphifyPathResolution
}

export function _resetGraphifyPathCacheForTesting(): void {
  cachedGraphifyPath = undefined
  pendingGraphifyPathResolution = undefined
}

export class GraphifyManager {
  private runningByWindow = new Map<number, boolean>()

  registerHandlers(): void {
    // Prewarm the login-shell resolution at startup so it's usually already
    // cached by the time the user clicks "Build graph".
    resolveGraphifyPath()

    ipcMain.handle('graphify:isAvailable', () => this.checkAvailable())

    ipcMain.handle('graphify:run', async (event, id: string, cwd: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      if (this.runningByWindow.get(win.id)) {
        if (!win.isDestroyed()) {
          win.webContents.send('graphify:data', id, 'A graphify run is already running.\n')
          win.webContents.send('graphify:exit', id, 1)
        }
        return
      }

      // spawn() also emits ENOENT when `cwd` doesn't exist (not just when the
      // binary is missing), which would otherwise misreport a deleted/renamed
      // project folder as "graphify not installed". Check upfront and give it
      // a distinct message instead.
      if (!existsSync(cwd)) {
        if (!win.isDestroyed()) {
          win.webContents.send('graphify:data', id, `Error: project directory not found: ${cwd}\r\n`)
          win.webContents.send('graphify:exit', id, 1)
        }
        return
      }

      this.runningByWindow.set(win.id, true)
      const bin = (await resolveGraphifyPath()) ?? 'graphify'
      const proc = spawn(bin, ['update', cwd], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })

      proc.stdout.on('data', (chunk: Buffer) => {
        if (!win.isDestroyed()) win.webContents.send('graphify:data', id, chunk.toString())
      })
      proc.stderr.on('data', (chunk: Buffer) => {
        if (!win.isDestroyed()) win.webContents.send('graphify:data', id, chunk.toString())
      })
      proc.on('error', (err: NodeJS.ErrnoException) => {
        this.runningByWindow.set(win.id, false)
        if (win.isDestroyed()) return
        if (err.code === 'ENOENT') {
          win.webContents.send('graphify:data', id, NOT_INSTALLED_MESSAGE)
        } else {
          win.webContents.send('graphify:data', id, `\r\nError: ${err.message}\r\n`)
        }
        win.webContents.send('graphify:exit', id, 1)
      })
      proc.on('close', (code: number | null) => {
        this.runningByWindow.set(win.id, false)
        if (!win.isDestroyed()) win.webContents.send('graphify:exit', id, code ?? 1)
      })
    })

    ipcMain.handle('graphify:readGraph', async (_e, cwd: string): Promise<GraphifyGraph> => {
      const raw = await readFile(join(cwd, 'graphify-out', 'graph.json'), 'utf-8')
      const parsed = JSON.parse(raw)
      // graphify's graph.json schema is undocumented upstream and could
      // change; a minimal shape guard here keeps a malformed-but-valid JSON
      // payload from flowing through to computeGraphLayout/GraphView (which
      // would throw on undefined.length with no top-level error boundary to
      // catch it) — throwing here routes into the same catch-and-set-null
      // path the renderer store already uses for parse failures.
      if (!Array.isArray(parsed?.nodes) || !Array.isArray(parsed?.links)) {
        throw new Error('graphify-out/graph.json has an unexpected shape (missing nodes/links arrays)')
      }
      return parsed as GraphifyGraph
    })
  }

  private async checkAvailable(): Promise<boolean> {
    const bin = (await resolveGraphifyPath()) ?? 'graphify'
    return new Promise((resolve) => {
      const proc = spawn(bin, ['--help'], { stdio: 'ignore' })
      proc.on('spawn', () => resolve(true))
      proc.on('error', () => resolve(false))
    })
  }
}
