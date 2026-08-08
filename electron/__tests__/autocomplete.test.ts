import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

const { handlers, spawnMock, execFileMock } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => unknown>,
  spawnMock: vi.fn(),
  execFileMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => unknown) => { handlers[channel] = fn },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
  },
}))

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
  execFile: (...args: unknown[]) => execFileMock(...args),
}))

import {
  buildSystemPrompt,
  buildUserPrompt,
  postProcessCompletion,
  resolveClaudePath,
  _resetClaudePathCacheForTesting,
  AutocompleteManager,
} from '../autocomplete'

describe('buildSystemPrompt', () => {
  it('instructs the model to respond with only the completion text', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('ONLY')
    expect(prompt).toContain('no markdown code fences')
  })
})

describe('buildUserPrompt', () => {
  it('wraps prefix and suffix with language and tags', () => {
    const prompt = buildUserPrompt('const x = ', ';\n', 'typescript')
    expect(prompt).toBe('Language: typescript\n<prefix>\nconst x = \n</prefix>\n<suffix>\n;\n\n</suffix>')
  })
})

describe('postProcessCompletion', () => {
  it('returns trimmed text unchanged when there are no code fences', () => {
    expect(postProcessCompletion('  const y = 2  \n')).toBe('const y = 2')
  })

  it('strips a fenced code block with a language tag', () => {
    expect(postProcessCompletion('```typescript\nconst y = 2\n```')).toBe('const y = 2')
  })

  it('strips a fenced code block with no language tag', () => {
    expect(postProcessCompletion('```\nconst y = 2\n```')).toBe('const y = 2')
  })

  it('returns null for an empty response', () => {
    expect(postProcessCompletion('   ')).toBeNull()
  })

  it('returns null when the fenced block is empty', () => {
    expect(postProcessCompletion('```\n\n```')).toBeNull()
  })

  it('preserves leading indentation on multi-line completions', () => {
    expect(postProcessCompletion('\n  return a + b;\n}')).toBe('  return a + b;\n}')
  })

  it('extracts a fenced block even when preceded by prose', () => {
    expect(postProcessCompletion("Here's the completion:\n```ts\nconst y = 2\n```")).toBe('const y = 2')
  })

  it('returns null when the completion exceeds the max length', () => {
    expect(postProcessCompletion('x'.repeat(2001))).toBeNull()
  })
})

function fakeProc() {
  const proc: any = new EventEmitter()
  proc.stdout = new EventEmitter()
  proc.kill = vi.fn(() => proc.emit('close', 1))
  return proc
}

function fakeWin(id: number) {
  return { id }
}

// A macrotask tick reliably drains however many microtask hops sit between
// calling the async handler and it reaching the synchronous spawn() call
// (the exact count depends on the await inside resolveClaudePath()), without
// the test needing to know or hardcode that number.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('resolveClaudePath', () => {
  beforeEach(() => {
    execFileMock.mockReset()
    _resetClaudePathCacheForTesting()
  })

  it('resolves the absolute path via a login shell', async () => {
    execFileMock.mockImplementation((_shell, _args, cb) => cb(null, '/Users/thomas/.local/bin/claude\n', ''))

    expect(await resolveClaudePath()).toBe('/Users/thomas/.local/bin/claude')
  })

  it('caches the result across calls (only resolves once)', async () => {
    execFileMock.mockImplementation((_shell, _args, cb) => cb(null, '/usr/local/bin/claude', ''))

    await resolveClaudePath()
    await resolveClaudePath()

    expect(execFileMock).toHaveBeenCalledTimes(1)
  })

  it('returns null when the shell command errors', async () => {
    execFileMock.mockImplementation((_shell, _args, cb) => cb(new Error('not found'), '', ''))

    expect(await resolveClaudePath()).toBeNull()
  })

  it('returns null when stdout is empty', async () => {
    execFileMock.mockImplementation((_shell, _args, cb) => cb(null, '', ''))

    expect(await resolveClaudePath()).toBeNull()
  })

  it('takes the last non-empty line of stdout, ignoring banner/preamble output', async () => {
    execFileMock.mockImplementation((_shell, _args, cb) =>
      cb(null, 'some banner text\n/usr/local/bin/claude\n', '')
    )

    expect(await resolveClaudePath()).toBe('/usr/local/bin/claude')
  })

  it('returns null when the resolved line is not an absolute path', async () => {
    execFileMock.mockImplementation((_shell, _args, cb) => cb(null, 'claude\n', ''))

    expect(await resolveClaudePath()).toBeNull()
  })

  it('does not cache a failed resolution, so the next call retries', async () => {
    execFileMock.mockImplementation((_shell, _args, cb) => cb(new Error('not found'), '', ''))

    expect(await resolveClaudePath()).toBeNull()
    expect(await resolveClaudePath()).toBeNull()

    expect(execFileMock).toHaveBeenCalledTimes(2)
  })
})

describe('AutocompleteManager autocomplete:complete', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    execFileMock.mockReset()
    execFileMock.mockImplementation((_shell, _args, cb) => cb(null, '/usr/local/bin/claude', ''))
    _resetClaudePathCacheForTesting()
  })

  function setup() {
    const manager = new AutocompleteManager()
    manager.registerHandlers()
    return { manager, handler: handlers['autocomplete:complete'] }
  }

  it('resolves with the completion text on success', async () => {
    const { handler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)

    const promise = handler({ sender: fakeWin(1) }, 'const x = ', '', 'typescript', 'claude-haiku-4-5-20251001')
    await flushMicrotasks()
    proc.stdout.emit('data', Buffer.from('1'))
    proc.emit('close', 0)

    expect(await promise).toBe('1')
  })

  it('spawns the resolved claude path directly (no shell) with the model and prompt', async () => {
    const { handler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)

    const promise = handler({ sender: fakeWin(1) }, 'const x = ', ';', 'typescript', 'claude-opus-5')
    await flushMicrotasks()
    proc.emit('close', 0)
    await promise

    const [command, args, options] = spawnMock.mock.calls[0]
    expect(command).toBe('/usr/local/bin/claude')
    expect(args).toContain('-p')
    expect(args[args.indexOf('--model') + 1]).toBe('claude-opus-5')
    expect(args[args.indexOf('--output-format') + 1]).toBe('text')
    expect(args).toContain('--no-session-persistence')
    // Guards against reintroducing shell interpretation of the prompt
    // (arbitrary user code) via a future `shell: true` "fix" for quoting.
    expect(options.shell).toBeFalsy()
    // Guards the single most consequence-heavy constraint in this feature:
    // passing --bare would silently break the user's subscription OAuth.
    expect(args).not.toContain('--bare')
  })

  it('resolves null on non-zero exit', async () => {
    const { handler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)

    const promise = handler({ sender: fakeWin(1) }, 'a', 'b', 'typescript', 'claude-haiku-4-5-20251001')
    await flushMicrotasks()
    proc.emit('close', 1)

    expect(await promise).toBeNull()
  })

  it('resolves null when the process errors', async () => {
    const { handler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)

    const promise = handler({ sender: fakeWin(1) }, 'a', 'b', 'typescript', 'claude-haiku-4-5-20251001')
    await flushMicrotasks()
    proc.emit('error', new Error('spawn failed'))

    expect(await promise).toBeNull()
  })

  it('resolves null (not rejects) when spawn() throws synchronously', async () => {
    const { handler } = setup()
    spawnMock.mockImplementationOnce(() => {
      throw new Error('spawn EINVAL, argv contains a null byte')
    })

    await expect(
      handler({ sender: fakeWin(1) }, 'a', 'b', 'typescript', 'claude-haiku-4-5-20251001')
    ).resolves.toBeNull()
  })

  it('resolves null without spawning when claude cannot be resolved on PATH', async () => {
    execFileMock.mockImplementation((_shell, _args, cb) => cb(new Error('not found'), '', ''))
    const { handler } = setup()

    expect(await handler({ sender: fakeWin(1) }, 'a', 'b', 'typescript', 'claude-haiku-4-5-20251001')).toBeNull()
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('kills the previous in-flight request for the same window when a new one arrives', async () => {
    const { handler } = setup()
    const procA = fakeProc()
    const procB = fakeProc()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)

    const promiseA = handler({ sender: fakeWin(1) }, 'a', '', 'typescript', 'claude-haiku-4-5-20251001')
    await flushMicrotasks()
    handler({ sender: fakeWin(1) }, 'ab', '', 'typescript', 'claude-haiku-4-5-20251001')

    expect(procA.kill).toHaveBeenCalled()
    expect(await promiseA).toBeNull()
  })

  it('does not affect an in-flight request in a different window', async () => {
    const { handler } = setup()
    const procA = fakeProc()
    const procB = fakeProc()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)

    const promiseA = handler({ sender: fakeWin(1) }, 'a', '', 'typescript', 'claude-haiku-4-5-20251001')
    await flushMicrotasks()
    const promiseB = handler({ sender: fakeWin(2) }, 'b', '', 'typescript', 'claude-haiku-4-5-20251001')
    await flushMicrotasks()

    expect(procA.kill).not.toHaveBeenCalled()

    procA.emit('close', 0)
    procB.emit('close', 0)
    await promiseA
    await promiseB
  })
})

describe('AutocompleteManager disposeWindow', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    execFileMock.mockReset()
    execFileMock.mockImplementation((_shell, _args, cb) => cb(null, '/usr/local/bin/claude', ''))
    _resetClaudePathCacheForTesting()
  })

  it('kills the in-flight process for that window', async () => {
    const manager = new AutocompleteManager()
    manager.registerHandlers()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)

    const promise = handlers['autocomplete:complete']({ sender: fakeWin(1) }, 'a', '', 'typescript', 'claude-haiku-4-5-20251001')
    await flushMicrotasks()
    manager.disposeWindow(1)

    expect(proc.kill).toHaveBeenCalled()
    await promise
  })
})

describe('AutocompleteManager timeout handling', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    execFileMock.mockReset()
    execFileMock.mockImplementation((_shell, _args, cb) => cb(null, '/usr/local/bin/claude', ''))
    _resetClaudePathCacheForTesting()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('kills the process and resolves null after 15s with no response', async () => {
    const manager = new AutocompleteManager()
    manager.registerHandlers()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)

    const promise = handlers['autocomplete:complete']({ sender: fakeWin(1) }, 'a', '', 'typescript', 'claude-haiku-4-5-20251001')
    // Real flushMicrotasks() relies on a real setTimeout(0) to drain the
    // microtask hops before spawn() is called; under fake timers that never
    // fires on its own, so advance fake time by 0ms to achieve the same effect.
    await vi.advanceTimersByTimeAsync(0)

    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(proc.kill).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(15000)

    expect(proc.kill).toHaveBeenCalled()
    expect(await promise).toBeNull()
  })

  it('does not fire the timeout when the process closes before 15s', async () => {
    const manager = new AutocompleteManager()
    manager.registerHandlers()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)

    const promise = handlers['autocomplete:complete']({ sender: fakeWin(1) }, 'a', '', 'typescript', 'claude-haiku-4-5-20251001')
    await vi.advanceTimersByTimeAsync(0)

    proc.stdout.emit('data', Buffer.from('done'))
    proc.emit('close', 0)

    expect(await promise).toBe('done')

    // The `finish()` early-exit path (electron/autocomplete.ts: `const finish
    // = (result) => { if (settled) return; ... }`) means a subsequent timer
    // firing must not re-kill an already-settled process. clearTimeout(timer)
    // is also called unconditionally inside finish(), so the timer is in fact
    // cancelled — but even if it weren't, advancing past 10s here proves no
    // observable double-kill / late resolution occurs.
    proc.kill.mockClear()
    await vi.advanceTimersByTimeAsync(15000)
    expect(proc.kill).not.toHaveBeenCalled()
  })
})
