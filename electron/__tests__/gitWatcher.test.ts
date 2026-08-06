import { describe, it, expect, beforeEach, vi } from 'vitest'

const { handlers, watchMock, watcherInstances } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
  watchMock: vi.fn(),
  watcherInstances: [] as any[],
}))

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
  },
}))

vi.mock('fs', () => ({ existsSync: () => true }))

vi.mock('chokidar', () => ({
  watch: (...args: unknown[]) => {
    watchMock(...args)
    const instance = { on: vi.fn(), close: vi.fn() }
    watcherInstances.push(instance)
    return instance
  },
}))

import { GitWatcher } from '../gitWatcher'

function fakeWin(id: number) {
  return { id, webContents: { send: vi.fn() } }
}

describe('GitWatcher multi-window isolation', () => {
  beforeEach(() => {
    watchMock.mockReset()
    watcherInstances.length = 0
  })

  it('watching different roots in two windows creates two independent watchers', () => {
    const manager = new GitWatcher()
    manager.registerHandlers()
    const winA = fakeWin(1)
    const winB = fakeWin(2)

    handlers['git:watchRoot']({ sender: winA }, '/project/a')
    handlers['git:watchRoot']({ sender: winB }, '/project/b')

    expect(watchMock).toHaveBeenCalledTimes(2)
    // Neither watcher was torn down by the other window's call — proves the
    // two are independent state, not one shared watcher recreated per call.
    expect(watcherInstances[0].close).not.toHaveBeenCalled()
    expect(watcherInstances[1].close).not.toHaveBeenCalled()
  })

  it('disposeWindow closes only that window\'s watcher', () => {
    const manager = new GitWatcher()
    manager.registerHandlers()
    const winA = fakeWin(1)
    const winB = fakeWin(2)

    handlers['git:watchRoot']({ sender: winA }, '/project/a')
    handlers['git:watchRoot']({ sender: winB }, '/project/b')
    manager.disposeWindow(1)

    expect(watcherInstances[0].close).toHaveBeenCalled()
    expect(watcherInstances[1].close).not.toHaveBeenCalled()
  })
})
