import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GitCommandAction } from '../../src/types/index'

const { ipcHandlers, spawnMock } = vi.hoisted(() => ({
  ipcHandlers: {} as Record<string, (...args: unknown[]) => unknown>,
  spawnMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      ipcHandlers[channel] = fn
    },
  },
}))

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    spawn: (...a: unknown[]) => spawnMock(...a),
  }
})

import { parsePorcelainStatus } from '../git'

describe('parsePorcelainStatus', () => {
  it('returns empty lists for no changes', () => {
    expect(parsePorcelainStatus('')).toEqual({ staged: [], unstaged: [] })
  })

  it('parses a staged modification', () => {
    const raw = 'M  src/foo.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/foo.ts', status: 'M' }],
      unstaged: [],
    })
  })

  it('parses an unstaged modification', () => {
    const raw = ' M src/foo.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [],
      unstaged: [{ path: 'src/foo.ts', status: 'M' }],
    })
  })

  it('parses a file staged and modified again (MM)', () => {
    const raw = 'MM src/foo.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/foo.ts', status: 'M' }],
      unstaged: [{ path: 'src/foo.ts', status: 'M' }],
    })
  })

  it('parses a staged addition', () => {
    const raw = 'A  src/new.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/new.ts', status: 'A' }],
      unstaged: [],
    })
  })

  it('parses an unstaged deletion', () => {
    const raw = ' D src/gone.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [],
      unstaged: [{ path: 'src/gone.ts', status: 'D' }],
    })
  })

  it('parses an untracked file', () => {
    const raw = '?? src/scratch.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [],
      unstaged: [{ path: 'src/scratch.ts', status: '?' }],
    })
  })

  it('parses a staged rename, skipping the old-path field and keeping the new path', () => {
    const raw = 'R  src/renamed.ts\0src/old-name.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/renamed.ts', status: 'R' }],
      unstaged: [],
    })
  })

  it('parses multiple mixed entries', () => {
    const raw = 'M  a.ts\0?? b.ts\0 D c.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'a.ts', status: 'M' }],
      unstaged: [
        { path: 'b.ts', status: '?' },
        { path: 'c.ts', status: 'D' },
      ],
    })
  })
})

function fakeProc() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
  return {
    stdout: { on: vi.fn((ev: string, cb: (...args: unknown[]) => void) => { (listeners[`stdout:${ev}`] ??= []).push(cb) }) },
    stderr: { on: vi.fn((ev: string, cb: (...args: unknown[]) => void) => { (listeners[`stderr:${ev}`] ??= []).push(cb) }) },
    on: vi.fn((ev: string, cb: (...args: unknown[]) => void) => { (listeners[ev] ??= []).push(cb) }),
    emit(channel: string, ...args: unknown[]) { listeners[channel]?.forEach(cb => cb(...args)) },
    emitStdout(data: string) { listeners['stdout:data']?.forEach(cb => cb(data)) },
    emitStderr(data: string) { listeners['stderr:data']?.forEach(cb => cb(data)) },
    emitClose(code: number) { listeners['close']?.forEach(cb => cb(code)) },
    kill: vi.fn(),
  }
}

describe('GitRunner', () => {
  let sends: { channel: string; args: unknown[] }[]
  let win: { webContents: { send: (...a: unknown[]) => void } }

  beforeEach(async () => {
    // Reset the shared handlers map for each test
    for (const key of Object.keys(ipcHandlers)) {
      delete ipcHandlers[key]
    }
    sends = []
    spawnMock.mockReset()
    win = { webContents: { send: (...a) => sends.push({ channel: a[0] as string, args: a.slice(1) }) } }
    vi.resetModules()
    const { GitRunner } = await import('../gitRunner')
    new GitRunner(win as any).registerHandlers()
  })

  it('spawns git with correct args for push', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await ipcHandlers['git:runCommand']({}, 'run-1', '/proj', 'push' as GitCommandAction)
    expect(spawnMock).toHaveBeenCalledWith('git', ['push'], expect.objectContaining({ cwd: '/proj' }))
  })

  it('spawns git with --force for forcePush', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await ipcHandlers['git:runCommand']({}, 'run-2', '/proj', 'forcePush' as GitCommandAction)
    expect(spawnMock).toHaveBeenCalledWith('git', ['push', '--force'], expect.objectContaining({ cwd: '/proj' }))
  })

  it('spawns git with --force-with-lease for forcePushLease', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await ipcHandlers['git:runCommand']({}, 'run-3', '/proj', 'forcePushLease' as GitCommandAction)
    expect(spawnMock).toHaveBeenCalledWith('git', ['push', '--force-with-lease'], expect.anything())
  })

  it('streams stdout as git:log:data events with the correct id', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await ipcHandlers['git:runCommand']({}, 'my-id', '/proj', 'fetch' as GitCommandAction)
    proc.emitStdout('Fetching origin\n')
    expect(sends).toContainEqual({ channel: 'git:log:data', args: ['my-id', 'Fetching origin\n'] })
  })

  it('streams stderr as git:log:data events', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await ipcHandlers['git:runCommand']({}, 'my-id', '/proj', 'pull' as GitCommandAction)
    proc.emitStderr('remote: Counting objects\n')
    expect(sends).toContainEqual({ channel: 'git:log:data', args: ['my-id', 'remote: Counting objects\n'] })
  })

  it('sends git:log:exit with the exit code on close', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await ipcHandlers['git:runCommand']({}, 'my-id', '/proj', 'push' as GitCommandAction)
    proc.emitClose(0)
    expect(sends).toContainEqual({ channel: 'git:log:exit', args: ['my-id', 0] })
  })

  it('sends a synthetic failing exit if a command is already running', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await ipcHandlers['git:runCommand']({}, 'first', '/proj', 'push' as GitCommandAction)
    await ipcHandlers['git:runCommand']({}, 'second', '/proj', 'pull' as GitCommandAction)
    const exitEvents = sends.filter(s => s.channel === 'git:log:exit')
    expect(exitEvents).toContainEqual({ channel: 'git:log:exit', args: ['second', 1] })
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })
})
