import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }))

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    execFile: (...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: unknown, result: { stdout: string; stderr: string }) => void
      const result = execFileMock(...args.slice(0, -1))
      if (result instanceof Error) cb(result, { stdout: '', stderr: '' })
      else cb(null, result)
    },
  }
})

import {
  checkDockerStatus,
  listContainers,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
  openDockerApp,
} from '../docker'

describe('checkDockerStatus', () => {
  beforeEach(() => execFileMock.mockReset())

  it('returns "running" when docker info succeeds', async () => {
    execFileMock.mockReturnValue({ stdout: 'abc123', stderr: '' })
    expect(await checkDockerStatus()).toBe('running')
  })

  it('returns "not-installed" when the docker binary is missing (ENOENT)', async () => {
    const err = Object.assign(new Error('spawn docker ENOENT'), { code: 'ENOENT' })
    execFileMock.mockReturnValue(err)
    expect(await checkDockerStatus()).toBe('not-installed')
  })

  it('returns "stopped" when the CLI exists but the daemon is unreachable', async () => {
    const err = Object.assign(new Error('Cannot connect to the Docker daemon'), { code: 1 })
    execFileMock.mockReturnValue(err)
    expect(await checkDockerStatus()).toBe('stopped')
  })
})

describe('listContainers', () => {
  beforeEach(() => execFileMock.mockReset())

  it('parses newline-delimited JSON rows from docker ps', async () => {
    const row1 = JSON.stringify({ ID: 'a1', Names: 'web', Image: 'nginx', Status: 'Up 2 hours', State: 'running', Ports: '80/tcp' })
    const row2 = JSON.stringify({ ID: 'b2', Names: 'db', Image: 'postgres', Status: 'Exited', State: 'exited', Ports: '' })
    execFileMock.mockReturnValue({ stdout: `${row1}\n${row2}\n`, stderr: '' })

    const containers = await listContainers()
    expect(containers).toEqual([
      { id: 'a1', name: 'web', image: 'nginx', status: 'Up 2 hours', state: 'running', ports: '80/tcp' },
      { id: 'b2', name: 'db', image: 'postgres', status: 'Exited', state: 'exited', ports: '' },
    ])
  })

  it('returns an empty list on failure', async () => {
    execFileMock.mockReturnValue(new Error('daemon not running'))
    expect(await listContainers()).toEqual([])
  })
})

describe('container action commands', () => {
  beforeEach(() => execFileMock.mockReset())

  it('startContainer reports ok on success', async () => {
    execFileMock.mockReturnValue({ stdout: '', stderr: '' })
    expect(await startContainer('a1')).toEqual({ ok: true })
    expect(execFileMock).toHaveBeenCalledWith('docker', ['start', 'a1'])
  })

  it('stopContainer surfaces stderr on failure', async () => {
    const err = Object.assign(new Error('fail'), { stderr: 'no such container' })
    execFileMock.mockReturnValue(err)
    expect(await stopContainer('missing')).toEqual({ ok: false, error: 'no such container' })
  })

  it('restartContainer calls docker restart', async () => {
    execFileMock.mockReturnValue({ stdout: '', stderr: '' })
    await restartContainer('a1')
    expect(execFileMock).toHaveBeenCalledWith('docker', ['restart', 'a1'])
  })

  it('removeContainer force-removes so a running container can be deleted in one step', async () => {
    execFileMock.mockReturnValue({ stdout: '', stderr: '' })
    await removeContainer('a1')
    expect(execFileMock).toHaveBeenCalledWith('docker', ['rm', '-f', 'a1'])
  })
})

describe('openDockerApp', () => {
  const originalPlatform = process.platform

  beforeEach(() => execFileMock.mockReset())
  afterEach(() => Object.defineProperty(process, 'platform', { value: originalPlatform }))

  it('opens Docker.app on macOS', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    execFileMock.mockReturnValue({ stdout: '', stderr: '' })
    expect(await openDockerApp()).toEqual({ ok: true })
    expect(execFileMock).toHaveBeenCalledWith('open', ['-a', 'Docker'])
  })

  it('uses systemctl on Linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    execFileMock.mockReturnValue({ stdout: '', stderr: '' })
    expect(await openDockerApp()).toEqual({ ok: true })
    expect(execFileMock).toHaveBeenCalledWith('systemctl', ['--user', 'start', 'docker'])
  })
})
