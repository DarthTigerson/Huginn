import { describe, it, expect, beforeEach, vi } from 'vitest'

const { handlers, spawnMock } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
  spawnMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
    on: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
  },
}))

vi.mock('node-pty', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}))

import { ClaudeManager } from '../claude'

function fakeWin(id: number) {
  return { id, webContents: { send: vi.fn() } }
}

function fakePty() {
  return {
    onData: vi.fn(),
    onExit: vi.fn(),
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
  }
}

describe('ClaudeManager assistant:spawn (attach mode)', () => {
  beforeEach(() => {
    spawnMock.mockReset()
  })

  function setup() {
    const manager = new ClaudeManager()
    manager.registerHandlers()
    return { manager, spawnHandler: handlers['assistant:spawn'] }
  }

  it('reuses the existing process when re-attaching with the same cwd', () => {
    const { spawnHandler } = setup()
    const win = fakeWin(1)
    const proc = fakePty()
    spawnMock.mockReturnValueOnce(proc)

    spawnHandler({ sender: win }, '/project/a', 'claude', undefined)
    spawnHandler({ sender: win }, '/project/a', 'claude', undefined)

    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(proc.kill).not.toHaveBeenCalled()
  })

  it('spawns a fresh process rooted in the new cwd when the project folder changes', () => {
    const { spawnHandler } = setup()
    const win = fakeWin(1)
    const procA = fakePty()
    const procB = fakePty()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)

    spawnHandler({ sender: win }, '/project/a', 'claude', undefined)
    spawnHandler({ sender: win }, '/project/b', 'claude', undefined)

    expect(spawnMock).toHaveBeenCalledTimes(2)
    expect(spawnMock.mock.calls[1][2]).toMatchObject({ cwd: '/project/b' })
    expect(procA.kill).toHaveBeenCalled()
  })

  it('keeps window A\'s assistant process running independent of window B', () => {
    const { spawnHandler } = setup()
    const winA = fakeWin(1)
    const winB = fakeWin(2)
    const procA = fakePty()
    const procB = fakePty()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)

    spawnHandler({ sender: winA }, '/project/a', 'claude', undefined)
    spawnHandler({ sender: winB }, '/project/b', 'claude', undefined)

    expect(procA.kill).not.toHaveBeenCalled()
    expect(procB.kill).not.toHaveBeenCalled()
    expect(spawnMock).toHaveBeenCalledTimes(2)
  })
})
