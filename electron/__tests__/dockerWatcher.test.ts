import { describe, it, expect, beforeEach, vi } from 'vitest'

const { onHandlers, spawnMock, procInstances } = vi.hoisted(() => ({
  onHandlers: {} as Record<string, (...args: any[]) => void>,
  spawnMock: vi.fn(),
  procInstances: [] as any[],
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

vi.mock('child_process', () => ({
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
}))

import { DockerWatcher } from '../dockerWatcher'

function fakeWin(id: number) {
  return { id, webContents: { send: vi.fn() } }
}

describe('DockerWatcher shared-process model', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    procInstances.length = 0
  })

  it('two windows watching share a single docker events process', () => {
    const watcher = new DockerWatcher()
    watcher.registerHandlers()

    onHandlers['docker:watch']({ sender: fakeWin(1) })
    onHandlers['docker:watch']({ sender: fakeWin(2) })

    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(spawnMock).toHaveBeenCalledWith('docker', ['events', '--format', '{{json .}}'], expect.anything())
  })

  it('does not stop the shared process while another window is still watching', () => {
    const watcher = new DockerWatcher()
    watcher.registerHandlers()

    onHandlers['docker:watch']({ sender: fakeWin(1) })
    onHandlers['docker:watch']({ sender: fakeWin(2) })
    watcher.disposeWindow(1)

    expect(procInstances[0].kill).not.toHaveBeenCalled()
  })

  it('stops the shared process once the last watching window disposes', () => {
    const watcher = new DockerWatcher()
    watcher.registerHandlers()

    onHandlers['docker:watch']({ sender: fakeWin(1) })
    onHandlers['docker:watch']({ sender: fakeWin(2) })
    watcher.disposeWindow(1)
    watcher.disposeWindow(2)

    expect(procInstances[0].kill).toHaveBeenCalled()
  })

  it('spawns a fresh process if watched again after the previous one died', () => {
    const watcher = new DockerWatcher()
    watcher.registerHandlers()

    onHandlers['docker:watch']({ sender: fakeWin(1) })
    procInstances[0].emit('close')
    onHandlers['docker:watch']({ sender: fakeWin(1) })

    expect(spawnMock).toHaveBeenCalledTimes(2)
  })
})
