import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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

import { ClaudeManager, ECHO_WINDOW_MS, IDLE_TIMEOUT_MS } from '../claude'

function fakeWin(id: number) {
  return { id, webContents: { send: vi.fn() }, isDestroyed: () => false }
}

function fakePty() {
  const dataCbs: Array<(d: string) => void> = []
  const exitCbs: Array<() => void> = []
  return {
    onData: (cb: (d: string) => void) => { dataCbs.push(cb) },
    onExit: (cb: () => void) => { exitCbs.push(cb) },
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    emitData(d: string) { dataCbs.forEach((cb) => cb(d)) },
    emitExit() { exitCbs.forEach((cb) => cb()) },
  }
}

function busyCalls(win: ReturnType<typeof fakeWin>): unknown[][] {
  return (win.webContents.send as ReturnType<typeof vi.fn>).mock.calls.filter(
    (call: unknown[]) => call[0] === 'assistant:busy'
  )
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

describe('ClaudeManager busy detection', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function setup() {
    const manager = new ClaudeManager()
    manager.registerHandlers()
    return { spawnHandler: handlers['assistant:spawn'], writeHandler: handlers['assistant:write'] }
  }

  function spawnClaude() {
    const { spawnHandler, writeHandler } = setup()
    const win = fakeWin(1)
    const proc = fakePty()
    spawnMock.mockReturnValueOnce(proc)
    spawnHandler({ sender: win }, '/project/a', 'claude', undefined)
    return { win, proc, writeHandler }
  }

  it('output with no recent input write marks busy immediately', () => {
    const { win, proc } = spawnClaude()
    proc.emitData('generating a response...')
    expect(busyCalls(win)).toEqual([['assistant:busy', 'claude', true]])
  })

  it('output arriving within ECHO_WINDOW_MS of our own write is treated as an echo, not busy', () => {
    const { win, proc, writeHandler } = spawnClaude()
    writeHandler({ sender: win }, 'claude', 'h')
    vi.advanceTimersByTime(ECHO_WINDOW_MS - 50)
    proc.emitData('h') // the CLI echoing the keystroke back to redraw its input box

    expect(busyCalls(win)).toEqual([])
  })

  it('output arriving after ECHO_WINDOW_MS of our own write still counts as real activity', () => {
    const { win, proc, writeHandler } = spawnClaude()
    writeHandler({ sender: win }, 'claude', 'h')
    vi.advanceTimersByTime(ECHO_WINDOW_MS + 50)
    proc.emitData('some real output')

    expect(busyCalls(win)).toEqual([['assistant:busy', 'claude', true]])
  })

  it('busy clears itself IDLE_TIMEOUT_MS after the last non-echo output', () => {
    const { win, proc } = spawnClaude()
    proc.emitData('chunk 1')
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS)

    expect(busyCalls(win)).toEqual([
      ['assistant:busy', 'claude', true],
      ['assistant:busy', 'claude', false],
    ])
  })

  it('further output resets the idle timer instead of stacking a stale one', () => {
    const { win, proc } = spawnClaude()
    proc.emitData('chunk 1')
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 200)
    proc.emitData('chunk 2') // resets the countdown
    vi.advanceTimersByTime(300) // past chunk 1's original deadline, not chunk 2's

    expect(busyCalls(win)).toEqual([['assistant:busy', 'claude', true]])

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS)
    expect(busyCalls(win)).toEqual([
      ['assistant:busy', 'claude', true],
      ['assistant:busy', 'claude', false],
    ])
  })

  it('does not send duplicate busy:true events while continuously active', () => {
    const { win, proc } = spawnClaude()
    proc.emitData('chunk 1')
    vi.advanceTimersByTime(100)
    proc.emitData('chunk 2')

    expect(busyCalls(win)).toEqual([['assistant:busy', 'claude', true]])
  })

  it('process exit clears busy', () => {
    const { win, proc } = spawnClaude()
    proc.emitData('chunk 1')
    proc.emitExit()

    expect(busyCalls(win)).toEqual([
      ['assistant:busy', 'claude', true],
      ['assistant:busy', 'claude', false],
    ])
  })
})
