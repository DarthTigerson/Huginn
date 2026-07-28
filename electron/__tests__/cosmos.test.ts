import { describe, it, expect, beforeEach, vi } from 'vitest'

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
