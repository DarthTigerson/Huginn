// electron/__tests__/graphify.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

const { ipcHandlers, spawnMock, readFileMock } = vi.hoisted(() => ({
  ipcHandlers: {} as Record<string, (...args: any[]) => unknown>,
  spawnMock: vi.fn(),
  readFileMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => unknown) => {
      ipcHandlers[channel] = fn
    },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
  },
}))

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return { ...actual, spawn: (...a: unknown[]) => spawnMock(...a) }
})

vi.mock('fs/promises', () => ({
  readFile: (...a: unknown[]) => readFileMock(...a),
}))

import { GraphifyManager } from '../graphify'

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
}

function fakeWin(id: number) {
  return { id, isDestroyed: () => false, webContents: { send: vi.fn() } }
}

describe('GraphifyManager', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    readFileMock.mockReset()
  })

  it('isAvailable resolves true when the process spawns successfully', async () => {
    const manager = new GraphifyManager()
    manager.registerHandlers()
    const proc = new FakeChildProcess()
    spawnMock.mockReturnValue(proc)

    const promise = ipcHandlers['graphify:isAvailable']({})
    proc.emit('spawn')
    await expect(promise).resolves.toBe(true)
    expect(spawnMock).toHaveBeenCalledWith('graphify', ['--help'], expect.any(Object))
  })

  it('isAvailable resolves false when the binary is missing (ENOENT)', async () => {
    const manager = new GraphifyManager()
    manager.registerHandlers()
    const proc = new FakeChildProcess()
    spawnMock.mockReturnValue(proc)

    const promise = ipcHandlers['graphify:isAvailable']({})
    proc.emit('error', Object.assign(new Error('not found'), { code: 'ENOENT' }))
    await expect(promise).resolves.toBe(false)
  })

  it('run spawns "graphify update <cwd>" and streams stdout as graphify:data', async () => {
    const manager = new GraphifyManager()
    manager.registerHandlers()
    const win = fakeWin(1)
    const proc = new FakeChildProcess()
    spawnMock.mockReturnValue(proc)

    await ipcHandlers['graphify:run']({ sender: win }, 'run-1', '/project')
    proc.stdout.emit('data', Buffer.from('working...'))

    expect(spawnMock).toHaveBeenCalledWith(
      'graphify',
      ['update', '/project'],
      expect.objectContaining({ cwd: '/project' })
    )
    expect(win.webContents.send).toHaveBeenCalledWith('graphify:data', 'run-1', 'working...')
  })

  it('run sends graphify:exit with the process exit code', async () => {
    const manager = new GraphifyManager()
    manager.registerHandlers()
    const win = fakeWin(1)
    const proc = new FakeChildProcess()
    spawnMock.mockReturnValue(proc)

    await ipcHandlers['graphify:run']({ sender: win }, 'run-1', '/project')
    proc.emit('close', 0)

    expect(win.webContents.send).toHaveBeenCalledWith('graphify:exit', 'run-1', 0)
  })

  it('run reports install instructions through graphify:data when the CLI is not installed', async () => {
    const manager = new GraphifyManager()
    manager.registerHandlers()
    const win = fakeWin(1)
    const proc = new FakeChildProcess()
    spawnMock.mockReturnValue(proc)

    await ipcHandlers['graphify:run']({ sender: win }, 'run-1', '/project')
    proc.emit('error', Object.assign(new Error('not found'), { code: 'ENOENT' }))

    expect(win.webContents.send).toHaveBeenCalledWith(
      'graphify:data',
      'run-1',
      expect.stringContaining('uv tool install graphifyy')
    )
    expect(win.webContents.send).toHaveBeenCalledWith('graphify:exit', 'run-1', 1)
  })

  it('a second run in the same window while one is in flight is rejected without spawning', async () => {
    const manager = new GraphifyManager()
    manager.registerHandlers()
    const win = fakeWin(1)
    const proc = new FakeChildProcess()
    spawnMock.mockReturnValue(proc)

    await ipcHandlers['graphify:run']({ sender: win }, 'run-1', '/project')
    await ipcHandlers['graphify:run']({ sender: win }, 'run-2', '/project')

    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(win.webContents.send).toHaveBeenCalledWith(
      'graphify:data',
      'run-2',
      expect.stringContaining('already running')
    )
  })

  it('readGraph parses graphify-out/graph.json relative to cwd', async () => {
    const manager = new GraphifyManager()
    manager.registerHandlers()
    readFileMock.mockResolvedValue(JSON.stringify({ directed: false, multigraph: false, nodes: [], links: [], hyperedges: [] }))

    const result = await ipcHandlers['graphify:readGraph']({}, '/project')

    expect(readFileMock).toHaveBeenCalledWith('/project/graphify-out/graph.json', 'utf-8')
    expect(result).toEqual({ directed: false, multigraph: false, nodes: [], links: [], hyperedges: [] })
  })
})
