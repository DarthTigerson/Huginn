import { ipcMain, type WebContents } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { extractVersionSection } from './changelog'

const REPO = 'DarthTigerson/vIDE'
const INSTALL_URL = `https://raw.githubusercontent.com/${REPO}/main/install.sh`
const CHANGELOG_URL = `https://raw.githubusercontent.com/${REPO}/main/CHANGELOG.md`

// pipefail matters: without it `curl … | bash` exits with bash's status, and
// bash exits 0 on empty input — so a failed download used to look like a
// successful update. VIDE_NO_LAUNCH stops install.sh from opening a second
// copy of the app; the Update page offers Restart instead (VIDE-142).
export const UPDATE_SCRIPT = `set -o pipefail; VIDE_NO_LAUNCH=1 curl -fsSL ${INSTALL_URL} | bash`

export interface UpdateOutputLine {
  line: string
  stream: 'stdout' | 'stderr'
}

// Splits a stream's chunks into whole lines, holding back a trailing
// partial line until the rest of it arrives.
export function createLineSplitter(onLine: (line: string) => void) {
  let pending = ''
  return {
    push(chunk: string) {
      const parts = (pending + chunk).split(/\r?\n/)
      pending = parts.pop() ?? ''
      for (const part of parts) if (part.trim()) onLine(part)
    },
    flush() {
      if (pending.trim()) onLine(pending)
      pending = ''
    },
  }
}

// Runs the install script in the background — no terminal tab — and streams
// its output and exit code to the window that started it, so the Update
// page can show stages instead of raw terminal text.
export class UpdateRunner {
  private child: ChildProcess | null = null

  constructor(private readonly spawnScript: (script: string) => ChildProcess = (script) =>
    spawn('/bin/bash', ['-c', script], { env: process.env })) {}

  get running(): boolean {
    return this.child !== null
  }

  run(target: WebContents): void {
    if (this.child) return
    const child = this.spawnScript(UPDATE_SCRIPT)
    this.child = child

    const send = (channel: string, payload: unknown) => {
      if (!target.isDestroyed()) target.send(channel, payload)
    }
    const splitter = (stream: UpdateOutputLine['stream']) =>
      createLineSplitter((line) => send('update:output', { line, stream } satisfies UpdateOutputLine))
    const out = splitter('stdout')
    const err = splitter('stderr')
    child.stdout?.on('data', (d: Buffer) => out.push(d.toString()))
    child.stderr?.on('data', (d: Buffer) => err.push(d.toString()))

    let finished = false
    const finish = (code: number) => {
      if (finished) return
      finished = true
      out.flush()
      err.flush()
      this.child = null
      send('update:exit', code)
    }
    child.on('error', (e) => {
      send('update:output', { line: `Couldn't start the update: ${e.message}`, stream: 'stderr' } satisfies UpdateOutputLine)
      finish(1)
    })
    child.on('close', (code) => finish(code ?? 1))
  }

  registerHandlers(): void {
    ipcMain.handle('update:run', (e) => this.run(e.sender))
    ipcMain.handle('update:getRemoteChangelog', (_e, version: string) => fetchRemoteChangelog(version))
  }
}

// The new version's CHANGELOG section, read from the repo before it's
// installed — the bundled CHANGELOG.md only has it after the update.
export async function fetchRemoteChangelog(version: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher(CHANGELOG_URL)
    if (!res.ok) return null
    return extractVersionSection(await res.text(), version)
  } catch {
    return null
  }
}
