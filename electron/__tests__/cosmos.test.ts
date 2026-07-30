import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { handlers } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
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

import { CosmosManager } from '../cosmos'

function sseStream(chunks: string[]): Response {
  const encoder = new TextEncoder()
  let i = 0
  const stream = new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]))
        i++
      } else {
        controller.close()
      }
    },
  })
  return new Response(stream, { status: 200 })
}

const SETTINGS = { endpoint: 'http://169.254.238.138:8002/v1', apiKey: 'local', modelId: 'test-model' }

describe('CosmosManager cosmos:send (text-only, no tool calls)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function setup() {
    const win = { webContents: { send: vi.fn() } } as any
    const manager = new CosmosManager(win)
    manager.registerHandlers()
    return { win, sendHandler: handlers['cosmos:send'] }
  }

  it('streams text-delta events from content chunks and ends with done', async () => {
    const { win, sendHandler } = setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseStream([
      'data: {"choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ])))

    await sendHandler({}, { cwd: '/project', messages: [{ role: 'user', content: 'hi' }], agentMode: false, settings: SETTINGS })

    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toEqual([
      { type: 'text-delta', delta: 'Hel' },
      { type: 'text-delta', delta: 'lo' },
      { type: 'done' },
    ])
  })

  it('sends an error event when the endpoint responds with a non-2xx status', async () => {
    const { win, sendHandler } = setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })))

    await sendHandler({}, { cwd: '/project', messages: [{ role: 'user', content: 'hi' }], agentMode: false, settings: SETTINGS })

    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toEqual([{ type: 'error', message: 'Cosmos request failed: 500' }])
  })

  it('posts to {endpoint}/chat/completions with the configured model and Authorization header', async () => {
    const { sendHandler } = setup()
    const fetchMock = vi.fn().mockResolvedValue(sseStream(['data: [DONE]\n\n']))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: '/project', messages: [{ role: 'user', content: 'hi' }], agentMode: false, settings: SETTINGS })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://169.254.238.138:8002/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer local', 'Content-Type': 'application/json' }),
      })
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('test-model')
    expect(body.stream).toBe(true)
  })
})

import { mkdtemp, writeFile as writeFileFs, readFile as readFileFs, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

describe('CosmosManager tool calls', () => {
  let root: string

  beforeEach(async () => {
    vi.restoreAllMocks()
    root = await mkdtemp(join(tmpdir(), 'cosmos-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  function setup() {
    const win = { webContents: { send: vi.fn() } } as any
    const manager = new CosmosManager(win)
    manager.registerHandlers()
    return { win, sendHandler: handlers['cosmos:send'], approveHandler: handlers['cosmos:approve'], rejectHandler: handlers['cosmos:reject'] }
  }

  function toolCallStream(name: string, args: Record<string, unknown>): Response {
    const argsJson = JSON.stringify(args)
    return sseStream([
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"${name}","arguments":""}}]},"finish_reason":null}]}\n\n`,
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":${JSON.stringify(argsJson)}}}]},"finish_reason":null}]}\n\n`,
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
      'data: [DONE]\n\n',
    ])
  }

  function finalTextStream(text: string): Response {
    return sseStream([
      `data: {"choices":[{"delta":{"content":${JSON.stringify(text)}},"finish_reason":null}]}\n\n`,
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ])
  }

  it('agent mode: executes write_file immediately and continues the loop', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'out.txt')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('write_file', { path: target, content: 'hi' }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'write it' }], agentMode: true, settings: SETTINGS })

    expect(await readFileFs(target, 'utf-8')).toBe('hi')
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual({ type: 'tool-call', id: 'call_1', name: 'write_file', args: { path: target, content: 'hi' } })
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool-result', id: 'call_1', isError: false }))
    expect(events).toContainEqual({ type: 'text-delta', delta: 'done' })
    expect(events).toContainEqual({ type: 'done' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('confirm mode: waits for approval before executing, does nothing on reject', async () => {
    const { win, sendHandler, rejectHandler } = setup()
    const target = join(root, 'out.txt')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('write_file', { path: target, content: 'hi' }))
      .mockResolvedValueOnce(finalTextStream('ok'))
    vi.stubGlobal('fetch', fetchMock)

    const runPromise = sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'write it' }], agentMode: false, settings: SETTINGS })

    await vi.waitFor(() => {
      const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
      expect(events).toContainEqual({ type: 'need-approval', id: 'call_1', name: 'write_file', args: { path: target, content: 'hi' } })
    })

    rejectHandler({}, 'call_1')
    await runPromise

    await expect(readFileFs(target, 'utf-8')).rejects.toThrow()
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool-result', id: 'call_1', isError: true }))
  })

  it('confirm mode: executes on approval', async () => {
    const { win, sendHandler, approveHandler } = setup()
    const target = join(root, 'out.txt')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('write_file', { path: target, content: 'hi' }))
      .mockResolvedValueOnce(finalTextStream('ok'))
    vi.stubGlobal('fetch', fetchMock)

    const runPromise = sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'write it' }], agentMode: false, settings: SETTINGS })

    await vi.waitFor(() => {
      const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
      expect(events).toContainEqual({ type: 'need-approval', id: 'call_1', name: 'write_file', args: { path: target, content: 'hi' } })
    })

    approveHandler({}, 'call_1')
    await runPromise

    expect(await readFileFs(target, 'utf-8')).toBe('hi')
  })

  it('run_command executes and captures stdout', async () => {
    const { win, sendHandler } = setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('run_command', { command: 'echo hello-cosmos' }))
      .mockResolvedValueOnce(finalTextStream('ran it'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'run it' }], agentMode: true, settings: SETTINGS })

    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    const result = events.find((e: any) => e.type === 'tool-result')
    expect(result.result).toContain('hello-cosmos')
  })

  it('stops and emits an error after 25 tool-call rounds', async () => {
    const { win, sendHandler } = setup()
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(toolCallStream('run_command', { command: 'echo loop' })))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'loop forever' }], agentMode: true, settings: SETTINGS })

    expect(fetchMock).toHaveBeenCalledTimes(25)
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events[events.length - 1]).toEqual({ type: 'error', message: 'Cosmos hit the 25 tool-call round limit for this turn' })
  })

  it('edit_file replaces a unique old_string with new_string', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'out.txt')
    await writeFileFs(target, 'hello world\nfoo bar\n')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('edit_file', { path: target, old_string: 'hello world', new_string: 'hello there' }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'edit it' }], agentMode: true, settings: SETTINGS })

    expect(await readFileFs(target, 'utf-8')).toBe('hello there\nfoo bar\n')
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool-result', id: 'call_1', isError: false }))
  })

  it('edit_file errors when old_string is not found', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'out.txt')
    await writeFileFs(target, 'hello world\n')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('edit_file', { path: target, old_string: 'nope', new_string: 'x' }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'edit it' }], agentMode: true, settings: SETTINGS })

    expect(await readFileFs(target, 'utf-8')).toBe('hello world\n')
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual({ type: 'tool-result', id: 'call_1', result: `old_string not found in ${target}`, isError: true })
  })

  it('edit_file errors when old_string is not unique', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'out.txt')
    await writeFileFs(target, 'dup\ndup\n')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('edit_file', { path: target, old_string: 'dup', new_string: 'x' }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'edit it' }], agentMode: true, settings: SETTINGS })

    expect(await readFileFs(target, 'utf-8')).toBe('dup\ndup\n')
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual({
      type: 'tool-result',
      id: 'call_1',
      result: `old_string appears 2 times in ${target} — include more surrounding context to make it unique`,
      isError: true,
    })
  })
})
