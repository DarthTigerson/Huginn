import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type DockerStatus = 'not-installed' | 'stopped' | 'running'

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  state: string
  ports: string
}

export interface DockerActionResult {
  ok: boolean
  error?: string
}

// `docker info` succeeds only when both the CLI is on PATH and the daemon
// is reachable. ENOENT (spawn failed to find the binary at all) means the
// CLI itself isn't installed; any other failure means the CLI exists but
// the daemon isn't running (Docker Desktop/Colima/etc not started).
export async function checkDockerStatus(): Promise<DockerStatus> {
  try {
    await execFileAsync('docker', ['info', '--format', '{{.ID}}'], { timeout: 5000 })
    return 'running'
  } catch (err) {
    const code = (err as { code?: string }).code
    return code === 'ENOENT' ? 'not-installed' : 'stopped'
  }
}

export async function listContainers(): Promise<DockerContainer[]> {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['ps', '-a', '--format', '{{json .}}'],
      { timeout: 5000, maxBuffer: 10 * 1024 * 1024 }
    )
    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const raw = JSON.parse(line) as Record<string, string>
        return {
          id: raw.ID,
          name: raw.Names,
          image: raw.Image,
          status: raw.Status,
          state: raw.State,
          ports: raw.Ports,
        }
      })
  } catch {
    return []
  }
}

async function runAction(args: string[]): Promise<DockerActionResult> {
  try {
    await execFileAsync('docker', args)
    return { ok: true }
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr
    return { ok: false, error: stderr?.trim() || 'Command failed' }
  }
}

export async function startContainer(id: string): Promise<DockerActionResult> {
  return runAction(['start', id])
}

export async function stopContainer(id: string): Promise<DockerActionResult> {
  return runAction(['stop', id])
}

export async function restartContainer(id: string): Promise<DockerActionResult> {
  return runAction(['restart', id])
}

// -f so a running container can be removed in one step instead of failing
// with "container is running" — the confirmation modal upstream is what
// gives the user a chance to back out, this is just the actual command.
export async function removeContainer(id: string): Promise<DockerActionResult> {
  return runAction(['rm', '-f', id])
}

// Starting the daemon itself (as opposed to a container) isn't a `docker`
// subcommand — it's whatever manages Docker Desktop/Colima/etc on the host,
// which differs per platform. Linux's systemd path generally needs a
// privileged docker group membership or passwordless sudo to succeed
// without a prompt Electron can't surface; when it fails we just report the
// stderr back so the popover can tell the user to start it manually.
export async function openDockerApp(): Promise<DockerActionResult> {
  try {
    if (process.platform === 'darwin') {
      await execFileAsync('open', ['-a', 'Docker'])
      return { ok: true }
    }
    if (process.platform === 'linux') {
      await execFileAsync('systemctl', ['--user', 'start', 'docker'])
      return { ok: true }
    }
    return { ok: false, error: 'Unsupported platform' }
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr
    return { ok: false, error: stderr?.trim() || 'Failed to start Docker — try starting it manually.' }
  }
}
