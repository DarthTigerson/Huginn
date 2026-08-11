import { execFile, spawn } from 'child_process'

// Electron-launched apps (Finder/Dock, not `npm run dev` from a terminal)
// don't inherit the interactive shell's PATH, so a bare spawn('gopls', ...)
// fails whenever a toolchain lives outside the default system PATH (nvm,
// rustup, a Go install under ~/go/bin, etc). Mirrors resolveGraphifyPath()
// in electron/graphify.ts / resolveClaudePath() in electron/autocomplete.ts:
// resolve the absolute path once via a login shell and cache it per command.
const cache = new Map<string, string | null>()
const pending = new Map<string, Promise<string | null>>()

export function resolveBinaryPath(command: string): Promise<string | null> {
  if (cache.has(command)) return Promise.resolve(cache.get(command) ?? null)
  const inFlight = pending.get(command)
  if (inFlight) return inFlight

  const promise = new Promise<string | null>((resolve) => {
    const shell = process.env.SHELL ?? '/bin/zsh'
    execFile(shell, ['-lic', `command -v ${command}`], (err, stdout) => {
      // `-lic` runs an interactive login shell, which sources .zshrc/.zprofile
      // and can prepend banners or version-manager output (nvm, pyenv, ...) to
      // stdout. Take the last non-empty line rather than the whole trimmed
      // output, and require it to look like an absolute path.
      const lines = (stdout ? stdout.toString() : '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
      const lastLine = lines[lines.length - 1]
      const resolved = !err && lastLine && lastLine.startsWith('/') ? lastLine : null
      // Only cache successes — caching a failure would silently disable
      // resolution for the rest of the app session on a transient hiccup.
      if (resolved) cache.set(command, resolved)
      resolve(resolved)
    })
  })
  pending.set(command, promise)
  promise.finally(() => pending.delete(command))
  return promise
}

export function resolveVersion(binPath: string, versionArgs: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(binPath, versionArgs, (err, stdout, stderr) => {
      if (err) {
        resolve(null)
        return
      }
      const out = (stdout || stderr || '').toString().trim().split('\n')[0]
      resolve(out || null)
    })
  })
}

// Resolves `command` via the login shell (falling back to the bare name so a
// missing binary still surfaces a clear ENOENT rather than silently no-op'ing),
// then spawns it and streams stdout+stderr chunks to `onData` until it exits.
export async function resolveAndRunStreamed(
  command: string,
  args: string[],
  onData: (chunk: string) => void
): Promise<void> {
  const bin = (await resolveBinaryPath(command)) ?? command
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    proc.stdout.on('data', (chunk: Buffer) => onData(chunk.toString()))
    proc.stderr.on('data', (chunk: Buffer) => onData(chunk.toString()))
    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') reject(new Error(`'${command}' not found in PATH.`))
      else reject(err)
    })
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`))))
  })
}

export function _resetShellPathCacheForTesting(): void {
  cache.clear()
  pending.clear()
}
