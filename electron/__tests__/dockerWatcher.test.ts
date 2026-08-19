import { describe, it, expect, beforeEach, vi } from 'vitest'

const { onHandlers, spawnMock, procInstances, execFileMock } = vi.hoisted(() => ({
  onHandlers: {} as Record<string, (...args: any[]) => void>,
  spawnMock: vi.fn(),
  procInstances: [] as any[],
  execFileMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, fn: (...args: any[]) => unknown) => {
      onHandlers[channel] = fn
    },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
    getAllWindows: () => [],
  },
}))

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    // resolveBinaryPath() (electron/lsp/shellPath.ts) resolves 'docker' via a
    // login shell before spawning `docker events` — always fail that
    // resolution here so ensureRunning() falls back to the bare 'docker'
    // name, matching what the spawn assertions below expect.
    execFile: (...a: unknown[]) => {
      execFileMock(...a)
      const cb = a[a.length - 1] as (err: Error | null, stdout: string) => void
      cb(new Error('not found'), '')
    },
    spawn: (...args: unknown[]) => {
      spawnMock(...args)
      const listeners: Record<string, ((...a: unknown[]) => void)[]> = {}
      const instance = {
        stdout: { on: (event: string, cb: (...a: unknown[]) => void) => { (listeners[event] ??= []).push(cb) } },
        on: (event: string, cb: (...a: unknown[]) => void) => { (listeners[event] ??= []).push(cb) },
        kill: vi.fn(),
        emit: (event: string, ...a: unknown[]) => listeners[event]?.forEach((cb) => cb(...a)),
      }
      procInstances.push(instance)
      return instance
    },
  }
})

import { DockerWatcher } from '../dockerWatcher'
import { _resetShellPathCacheForTesting } from '../lsp/shellPath'

function fakeWin(id: number) {
  return { id, webContents: { send: vi.fn() } }
}

// ensureRunning() awaits resolveBinaryPath() (itself promise-based) before
// spawning — give that a tick to settle so spawn() has been called before
// assertions run.
function waitForSpawn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

describe('DockerWatcher shared-process model', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    execFileMock.mockReset()
    procInstances.length = 0
    _resetShellPathCacheForTesting()
  })

  it('two windows watching share a single docker events process', async () => {
    const watcher = new DockerWatcher()
    watcher.registerHandlers()

    onHandlers['docker:watch']({ sender: fakeWin(1) })
    onHandlers['docker:watch']({ sender: fakeWin(2) })
    await waitForSpawn()

    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(spawnMock).toHaveBeenCalledWith('docker', ['events', '--format', '{{json .}}'], expect.anything())
  })

  it('does not stop the shared process while another window is still watching', async () => {
    const watcher = new DockerWatcher()
    watcher.registerHandlers()

    onHandlers['docker:watch']({ sender: fakeWin(1) })
    onHandlers['docker:watch']({ sender: fakeWin(2) })
    await waitForSpawn()
    watcher.disposeWindow(1)

    expect(procInstances[0].kill).not.toHaveBeenCalled()
  })

  it('stops the shared process once the last watching window disposes', async () => {
    const watcher = new DockerWatcher()
    watcher.registerHandlers()

    onHandlers['docker:watch']({ sender: fakeWin(1) })
    onHandlers['docker:watch']({ sender: fakeWin(2) })
    await waitForSpawn()
    watcher.disposeWindow(1)
    watcher.disposeWindow(2)

    expect(procInstances[0].kill).toHaveBeenCalled()
  })

  it('spawns a fresh process if watched again after the previous one died', async () => {
    const watcher = new DockerWatcher()
    watcher.registerHandlers()

    onHandlers['docker:watch']({ sender: fakeWin(1) })
    await waitForSpawn()
    procInstances[0].emit('close')
    onHandlers['docker:watch']({ sender: fakeWin(1) })
    await waitForSpawn()

    expect(spawnMock).toHaveBeenCalledTimes(2)
  })
})
