import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import type { GitCommandAction } from '../src/types/index'
import { getGitBranch, getAheadBehind, getGitStatus, stageFiles, unstageFiles, stageAll, unstageAll, commit, getDiffContent } from './git'

const ARGS: Record<GitCommandAction, string[]> = {
  fetch:           ['fetch'],
  pull:            ['pull'],
  push:            ['push'],
  forcePush:       ['push', '--force'],
  forcePushLease:  ['push', '--force-with-lease'],
}

export class GitRunner {
  private win: BrowserWindow
  private running: boolean = false

  constructor(win: BrowserWindow) {
    this.win = win
  }

  registerHandlers(): void {
    ipcMain.handle('git:runCommand', (_e, id: string, cwd: string, action: GitCommandAction) => {
      if (this.running) {
        this.win.webContents.send('git:log:data', id, 'A git command is already running.\n')
        this.win.webContents.send('git:log:exit', id, 1)
        return
      }

      this.running = true
      const proc = spawn('git', ARGS[action], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })

      proc.stdout.on('data', (chunk: Buffer) => {
        this.win.webContents.send('git:log:data', id, chunk.toString())
      })
      proc.stderr.on('data', (chunk: Buffer) => {
        this.win.webContents.send('git:log:data', id, chunk.toString())
      })
      proc.on('close', (code: number | null) => {
        this.running = false
        this.win.webContents.send('git:log:exit', id, code ?? 1)
      })
    })

    // Re-register all existing git handlers (previously in registerGitHandlers)
    ipcMain.handle('git:branch', (_e, cwd: string) => getGitBranch(cwd))
    ipcMain.handle('git:aheadBehind', (_e, cwd: string) => getAheadBehind(cwd))
    ipcMain.handle('git:status', (_e, cwd: string) => getGitStatus(cwd))
    ipcMain.handle('git:stage', (_e, cwd: string, paths: string[]) => stageFiles(cwd, paths))
    ipcMain.handle('git:unstage', (_e, cwd: string, paths: string[]) => unstageFiles(cwd, paths))
    ipcMain.handle('git:stageAll', (_e, cwd: string) => stageAll(cwd))
    ipcMain.handle('git:unstageAll', (_e, cwd: string) => unstageAll(cwd))
    ipcMain.handle('git:commit', (_e, cwd: string, message: string) => commit(cwd, message))
    ipcMain.handle('git:diff', (_e, cwd: string, path: string, staged: boolean) => getDiffContent(cwd, path, staged))
  }
}
