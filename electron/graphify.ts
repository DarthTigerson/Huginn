import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { GraphifyGraph } from '../src/types/graphify'

const NOT_INSTALLED_MESSAGE =
  "Error: 'graphify' not found in PATH.\r\nInstall it with: uv tool install graphifyy && graphify install\r\n"

export class GraphifyManager {
  private runningByWindow = new Map<number, boolean>()

  registerHandlers(): void {
    ipcMain.handle('graphify:isAvailable', () => this.checkAvailable())

    ipcMain.handle('graphify:run', (event, id: string, cwd: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      if (this.runningByWindow.get(win.id)) {
        if (!win.isDestroyed()) {
          win.webContents.send('graphify:data', id, 'A graphify run is already running.\n')
          win.webContents.send('graphify:exit', id, 1)
        }
        return
      }

      this.runningByWindow.set(win.id, true)
      const proc = spawn('graphify', ['update', cwd], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })

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
      return JSON.parse(raw) as GraphifyGraph
    })
  }

  private checkAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('graphify', ['--help'], { stdio: 'ignore' })
      proc.on('spawn', () => resolve(true))
      proc.on('error', () => resolve(false))
    })
  }
}
