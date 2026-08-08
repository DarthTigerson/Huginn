const SYSTEM_PROMPT = `You are a code-completion engine embedded in a code editor. You will be given the code immediately before the cursor (<prefix>) and immediately after the cursor (<suffix>). Respond with ONLY the exact text that should be inserted at the cursor to continue the code naturally — no explanations, no markdown code fences, no repeating text that already appears in the prefix or suffix. If no reasonable completion exists, respond with nothing.`

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildUserPrompt(prefix: string, suffix: string, language: string): string {
  return `Language: ${language}\n<prefix>\n${prefix}\n</prefix>\n<suffix>\n${suffix}\n</suffix>`
}

export function postProcessCompletion(raw: string): string | null {
  let text = raw.trim()
  if (!text) return null

  const fenced = text.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n?```$/)
  if (fenced) text = fenced[1].trim()

  return text.length > 0 ? text : null
}

import { BrowserWindow, ipcMain } from 'electron'
import { execFile, spawn, type ChildProcessByStdio } from 'child_process'
import type { Readable } from 'stream'

const TIMEOUT_MS = 10000

// Electron-launched apps on macOS don't inherit the interactive shell's PATH,
// so a bare spawn('claude', ...) fails whenever the CLI lives outside the
// default system PATH (e.g. ~/.local/bin, nvm — exactly how it's installed
// here). Resolve the absolute path once via a login shell and cache it, then
// spawn that path directly for every real completion request: this avoids
// paying a login shell's startup cost on every keystroke, and avoids ever
// shell-interpreting the prompt content (arbitrary user code) on every call.
let cachedClaudePath: string | null | undefined

export function resolveClaudePath(): Promise<string | null> {
  if (cachedClaudePath !== undefined) return Promise.resolve(cachedClaudePath)

  return new Promise((resolve) => {
    const shell = process.env.SHELL ?? '/bin/zsh'
    execFile(shell, ['-lic', 'command -v claude'], (err, stdout) => {
      const resolved = !err && stdout ? stdout.toString().trim() : ''
      cachedClaudePath = resolved.length > 0 ? resolved : null
      resolve(cachedClaudePath)
    })
  })
}

export function _resetClaudePathCacheForTesting(): void {
  cachedClaudePath = undefined
}

export class AutocompleteManager {
  private currentByWindow = new Map<number, ChildProcessByStdio<null, Readable, Readable>>()

  registerHandlers(): void {
    resolveClaudePath()

    ipcMain.handle(
      'autocomplete:complete',
      (event, prefix: string, suffix: string, language: string, model: string) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) return Promise.resolve(null)
        return this.complete(win.id, prefix, suffix, language, model)
      }
    )
  }

  disposeWindow(windowId: number): void {
    this.currentByWindow.get(windowId)?.kill()
    this.currentByWindow.delete(windowId)
  }

  private async complete(
    windowId: number,
    prefix: string,
    suffix: string,
    language: string,
    model: string
  ): Promise<string | null> {
    this.currentByWindow.get(windowId)?.kill()

    const claudePath = await resolveClaudePath()
    if (!claudePath) return null

    return new Promise((resolve) => {
      const proc = spawn(
        claudePath,
        [
          '-p', buildUserPrompt(prefix, suffix, language),
          '--model', model,
          '--output-format', 'text',
          '--no-session-persistence',
          '--tools', '',
          '--setting-sources', '',
          '--system-prompt', buildSystemPrompt(),
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      )

      this.currentByWindow.set(windowId, proc)

      let stdout = ''
      let settled = false

      const finish = (result: string | null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (this.currentByWindow.get(windowId) === proc) this.currentByWindow.delete(windowId)
        resolve(result)
      }

      const timer = setTimeout(() => {
        proc.kill()
        finish(null)
      }, TIMEOUT_MS)

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      proc.on('error', () => finish(null))
      proc.on('close', (code) => {
        if (code !== 0) { finish(null); return }
        finish(postProcessCompletion(stdout))
      })
    })
  }
}
