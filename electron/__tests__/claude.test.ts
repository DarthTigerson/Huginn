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
}))

vi.mock('node-pty', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}))

import { ClaudeManager } from '../claude'

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
    const win = { webContents: { send: vi.fn() } } as any
    const manager = new ClaudeManager(win)
    manager.registerHandlers()
    return handlers['assistant:spawn']
  }

  it('reuses the existing process when re-attaching with the same cwd', () => {
    const spawnHandler = setup()
    const proc = fakePty()
    spawnMock.mockReturnValueOnce(proc)

    spawnHandler({}, '/project/a', 'claude', undefined)
    spawnHandler({}, '/project/a', 'claude', undefined)

    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(proc.kill).not.toHaveBeenCalled()
  })

  it('spawns a fresh process rooted in the new cwd when the project folder changes', () => {
    const spawnHandler = setup()
    const procA = fakePty()
    const procB = fakePty()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)

    spawnHandler({}, '/project/a', 'claude', undefined)
    spawnHandler({}, '/project/b', 'claude', undefined)

    expect(spawnMock).toHaveBeenCalledTimes(2)
    expect(spawnMock.mock.calls[1][2]).toMatchObject({ cwd: '/project/b' })
    expect(procA.kill).toHaveBeenCalled()
  })
})
