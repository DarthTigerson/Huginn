import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import type { GitCommandAction } from '../src/types/index'
import { getGitBranch, getGitBranches, getAheadBehind, getGitStatus, stageFiles, unstageFiles, stageAll, unstageAll, commit, discardFileChanges, getDiffContent, getGitGraph, getGitBranchDiff, getGitShowStat, getIgnoredPaths } from './git'

const ARGS: Record<GitCommandAction, string[]> = {
  fetch:           ['fetch'],
  pull:            ['pull'],
  push:            ['push'],
  forcePush:       ['push', '--force'],
  forcePushLease:  ['push', '--force-with-lease'],
}

export class GitRunner {
  private runningByWindow = new Map<number, boolean>()

  registerHandlers(): void {
    ipcMain.handle('git:runCommand', (event, id: string, cwd: string, action: GitCommandAction) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      if (this.runningByWindow.get(win.id)) {
        if (!win.isDestroyed()) {
          win.webContents.send('git:log:data', id, 'A git command is already running.\n')
          win.webContents.send('git:log:exit', id, 1)
        }
        return
      }

      this.runningByWindow.set(win.id, true)
      const proc = spawn('git', ARGS[action], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })

      proc.stdout.on('data', (chunk: Buffer) => {
        if (!win.isDestroyed()) win.webContents.send('git:log:data', id, chunk.toString())
      })
      proc.stderr.on('data', (chunk: Buffer) => {
        if (!win.isDestroyed()) win.webContents.send('git:log:data', id, chunk.toString())
      })
      proc.on('close', (code: number | null) => {
        this.runningByWindow.set(win.id, false)
        if (!win.isDestroyed()) win.webContents.send('git:log:exit', id, code ?? 1)
      })
    })

    // Re-register all existing git handlers (previously in registerGitHandlers)
    ipcMain.handle('git:branch', (_e, cwd: string) => getGitBranch(cwd))
    ipcMain.handle('git:aheadBehind', (_e, cwd: string) => getAheadBehind(cwd))
    ipcMain.handle('git:status', (_e, cwd: string) => getGitStatus(cwd))
    ipcMain.handle('git:listIgnored', (_e, cwd: string) => getIgnoredPaths(cwd))
    ipcMain.handle('git:stage', (_e, cwd: string, paths: string[]) => stageFiles(cwd, paths))
    ipcMain.handle('git:unstage', (_e, cwd: string, paths: string[]) => unstageFiles(cwd, paths))
    ipcMain.handle('git:stageAll', (_e, cwd: string) => stageAll(cwd))
    ipcMain.handle('git:unstageAll', (_e, cwd: string) => unstageAll(cwd))
    ipcMain.handle('git:discard', (_e, cwd: string, path: string) => discardFileChanges(cwd, path))
    ipcMain.handle('git:commit', (_e, cwd: string, message: string) => commit(cwd, message))
    ipcMain.handle('git:diff', (_e, cwd: string, path: string, staged: boolean) => getDiffContent(cwd, path, staged))
    ipcMain.handle('git:graph', (_e, cwd: string) => getGitGraph(cwd))
    ipcMain.handle('git:branches', (_e, cwd: string) => getGitBranches(cwd))
    ipcMain.handle('git:branchDiff', (_e, cwd: string, source: string, target: string) => getGitBranchDiff(cwd, source, target))
    ipcMain.handle('git:showStat', (_e, cwd: string, hash: string) => getGitShowStat(cwd, hash))
  }
}
