import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'
import { join } from 'path'

const execFileAsync = promisify(execFile)

export interface GitFileEntry {
  path: string
  status: 'M' | 'A' | 'D' | 'R' | '?'
}

export interface GitStatus {
  staged: GitFileEntry[]
  unstaged: GitFileEntry[]
}

export async function getGitBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })
    const branch = stdout.trim()
    if (branch !== 'HEAD') return branch
    const { stdout: sha } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd })
    return sha.trim()
  } catch {
    return null
  }
}

function toStatus(code: string): GitFileEntry['status'] {
  return code === 'A' || code === 'D' || code === 'R' ? code : 'M'
}

export function parsePorcelainStatus(raw: string): GitStatus {
  const staged: GitFileEntry[] = []
  const unstaged: GitFileEntry[] = []
  if (!raw) return { staged, unstaged }

  const entries = raw.split('\0').filter(Boolean)
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const x = entry[0]
    const y = entry[1]
    const path = entry.slice(3)

    if (x === 'R') {
      // porcelain -z emits the old path as a separate NUL-terminated
      // field right after a rename entry — skip over it
      i++
    }

    if (x === '?' && y === '?') {
      unstaged.push({ path, status: '?' })
      continue
    }

    if (x !== ' ' && x !== '?') {
      staged.push({ path, status: toStatus(x) })
    }
    if (y !== ' ' && y !== '?') {
      unstaged.push({ path, status: toStatus(y) })
    }
  }

  return { staged, unstaged }
}

export async function getGitStatus(cwd: string): Promise<GitStatus> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain=v1', '-z'], { cwd })
    return parsePorcelainStatus(stdout)
  } catch {
    return { staged: [], unstaged: [] }
  }
}

export async function stageFiles(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await execFileAsync('git', ['add', '--', ...paths], { cwd })
}

export async function unstageFiles(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await execFileAsync('git', ['reset', '--', ...paths], { cwd })
}

export async function stageAll(cwd: string): Promise<void> {
  await execFileAsync('git', ['add', '-A'], { cwd })
}

export async function unstageAll(cwd: string): Promise<void> {
  await execFileAsync('git', ['reset'], { cwd })
}

export async function commit(
  cwd: string,
  message: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await execFileAsync('git', ['commit', '-m', message], { cwd })
    return { ok: true }
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr
    return { ok: false, error: stderr?.trim() || 'Commit failed' }
  }
}

async function showRef(cwd: string, ref: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['show', ref], { cwd })
    return stdout
  } catch {
    return ''
  }
}

export async function getDiffContent(
  cwd: string,
  path: string,
  staged: boolean
): Promise<{ original: string; modified: string }> {
  if (staged) {
    const original = await showRef(cwd, `HEAD:${path}`)
    const modified = await showRef(cwd, `:${path}`)
    return { original, modified }
  }

  const original = await showRef(cwd, `:${path}`)
  let modified = ''
  try {
    modified = await readFile(join(cwd, path), 'utf-8')
  } catch {
    modified = ''
  }
  return { original, modified }
}

export function registerGitHandlers(): void {
  ipcMain.handle('git:branch', (_e, cwd: string) => getGitBranch(cwd))
  ipcMain.handle('git:status', (_e, cwd: string) => getGitStatus(cwd))
  ipcMain.handle('git:stage', (_e, cwd: string, paths: string[]) => stageFiles(cwd, paths))
  ipcMain.handle('git:unstage', (_e, cwd: string, paths: string[]) => unstageFiles(cwd, paths))
  ipcMain.handle('git:stageAll', (_e, cwd: string) => stageAll(cwd))
  ipcMain.handle('git:unstageAll', (_e, cwd: string) => unstageAll(cwd))
  ipcMain.handle('git:commit', (_e, cwd: string, message: string) => commit(cwd, message))
  ipcMain.handle('git:diff', (_e, cwd: string, path: string, staged: boolean) =>
    getDiffContent(cwd, path, staged)
  )
}
