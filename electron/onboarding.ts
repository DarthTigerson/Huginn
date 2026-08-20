import { app, ipcMain, shell } from 'electron'
import { execFile } from 'child_process'
import { join } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'

export interface OnboardingStatus {
  completed: boolean
}

export interface GitIdentity {
  name: string | null
  email: string | null
}

function flagPath(): string {
  return join(app.getPath('userData'), 'onboarding.json')
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  try {
    const data = await readFile(flagPath(), 'utf-8')
    const parsed = JSON.parse(data)
    return { completed: parsed?.completed === true }
  } catch {
    // No flag file yet covers both a brand-new install and every existing
    // user updating from a release that predates this wizard — in both
    // cases nobody has seen it before, so absence alone is enough to show it.
    return { completed: false }
  }
}

async function writeStatus(status: OnboardingStatus): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(flagPath(), JSON.stringify(status), 'utf-8')
}

export async function markOnboardingComplete(): Promise<void> {
  await writeStatus({ completed: true })
}

export async function resetOnboarding(): Promise<void> {
  await writeStatus({ completed: false })
}

// Electron-launched apps (Finder/Dock, not a terminal) don't inherit the
// interactive shell's PATH, so a bare `command -v` on process.env.PATH alone
// can miss CLIs installed via nvm/uv/homebrew into a non-default location.
// Mirrors resolveClaudePath() in electron/autocomplete.ts, but this runs
// once per wizard visit rather than needing autocomplete's per-session cache.
export function detectCli(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const shellBin = process.env.SHELL ?? '/bin/zsh'
    execFile(shellBin, ['-lic', `command -v ${bin}`], (err, stdout) => {
      const lines = (stdout ? stdout.toString() : '').split('\n').map((l) => l.trim()).filter(Boolean)
      const lastLine = lines[lines.length - 1]
      resolve(!err && !!lastLine && lastLine.startsWith('/'))
    })
  })
}

function readGitConfig(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('git', ['config', '--global', key], (err, stdout) => {
      // `git config` exits non-zero when the key isn't set — that's the
      // expected "not configured yet" case, not a failure to report.
      resolve(!err ? stdout.toString().trim() || null : null)
    })
  })
}

export async function getGitIdentity(): Promise<GitIdentity> {
  const [name, email] = await Promise.all([readGitConfig('user.name'), readGitConfig('user.email')])
  return { name, email }
}

function writeGitConfig(key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('git', ['config', '--global', key, value], (err) => (err ? reject(err) : resolve()))
  })
}

export async function setGitIdentity(name: string, email: string): Promise<void> {
  await writeGitConfig('user.name', name)
  await writeGitConfig('user.email', email)
}

// Deliberately triggers macOS's "would like to access data from other apps"
// Automation prompt (shell.trashItem asks Finder to do the move, which is
// what requires the permission) against a disposable scratch file, on a
// screen that explains why — instead of it ambushing the user later during
// an ordinary file delete or git discard.
export async function primeAutomationPermission(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  const dir = join(app.getPath('userData'), '.onboarding-tmp')
  const scratchPath = join(dir, `permission-check-${Date.now()}`)
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(scratchPath, '', 'utf-8')
    await shell.trashItem(scratchPath)
    return true
  } catch {
    return false
  }
}

export function openAutomationSettings(): void {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Automation')
}

export function registerOnboardingHandlers(): void {
  ipcMain.handle('onboarding:getStatus', () => getOnboardingStatus())
  ipcMain.handle('onboarding:markComplete', () => markOnboardingComplete())
  ipcMain.handle('onboarding:reset', () => resetOnboarding())
  ipcMain.handle('onboarding:detectCli', (_e, bin: string) => detectCli(bin))
  ipcMain.handle('onboarding:getGitIdentity', () => getGitIdentity())
  ipcMain.handle('onboarding:setGitIdentity', (_e, name: string, email: string) => setGitIdentity(name, email))
  ipcMain.handle('onboarding:primeAutomationPermission', () => primeAutomationPermission())
  ipcMain.handle('onboarding:openAutomationSettings', () => openAutomationSettings())
}
