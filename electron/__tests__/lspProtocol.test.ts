import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'
import { LspConnection } from '../lsp/protocol'

function frame(payload: object): string {
  const json = JSON.stringify(payload)
  return `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`
}

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter()
  stdin = { write: vi.fn() }
}

describe('LspConnection', () => {
  it('sends a Content-Length framed request and resolves on the matching response', async () => {
    const proc = new FakeChildProcess()
    const conn = new LspConnection(proc as any)

    const pending = conn.request('textDocument/definition', { foo: 'bar' })

    expect(proc.stdin.write).toHaveBeenCalledTimes(1)
    const sent = (proc.stdin.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(sent).toMatch(/^Content-Length: \d+\r\n\r\n/)
    const body = JSON.parse(sent.slice(sent.indexOf('\r\n\r\n') + 4))
    expect(body).toMatchObject({ jsonrpc: '2.0', method: 'textDocument/definition', params: { foo: 'bar' } })

    proc.stdout.emit('data', Buffer.from(frame({ jsonrpc: '2.0', id: body.id, result: { ok: true } })))

    await expect(pending).resolves.toEqual({ ok: true })
  })

  it('reassembles a message split across multiple chunks', async () => {
    const proc = new FakeChildProcess()
    const conn = new LspConnection(proc as any)
    const pending = conn.request('initialize', {})
    const sentId = JSON.parse(
      (proc.stdin.write as ReturnType<typeof vi.fn>).mock.calls[0][0].slice(
        (proc.stdin.write as ReturnType<typeof vi.fn>).mock.calls[0][0].indexOf('\r\n\r\n') + 4
      )
    ).id

    const raw = frame({ jsonrpc: '2.0', id: sentId, result: null })
    proc.stdout.emit('data', Buffer.from(raw.slice(0, 10)))
    proc.stdout.emit('data', Buffer.from(raw.slice(10)))

    await expect(pending).resolves.toBeNull()
  })

  it('rejects a pending request when the server responds with an error', async () => {
    const proc = new FakeChildProcess()
    const conn = new LspConnection(proc as any)
    const pending = conn.request('textDocument/definition', {})
    const sentId = JSON.parse(
      (proc.stdin.write as ReturnType<typeof vi.fn>).mock.calls[0][0].slice(
        (proc.stdin.write as ReturnType<typeof vi.fn>).mock.calls[0][0].indexOf('\r\n\r\n') + 4
      )
    ).id

    proc.stdout.emit(
      'data',
      Buffer.from(frame({ jsonrpc: '2.0', id: sentId, error: { code: -1, message: 'boom' } }))
    )

    await expect(pending).rejects.toThrow('boom')
  })

  it('rejects all pending requests when the process exits', async () => {
    const proc = new FakeChildProcess()
    const conn = new LspConnection(proc as any)
    const pending = conn.request('textDocument/definition', {})

    proc.emit('exit')

    await expect(pending).rejects.toThrow('Language server exited')
  })

  it('notify() does not wait for a response and writes immediately', () => {
    const proc = new FakeChildProcess()
    const conn = new LspConnection(proc as any)
    conn.notify('textDocument/didOpen', { uri: 'file:///a.ts' })

    expect(proc.stdin.write).toHaveBeenCalledTimes(1)
    const sent = (proc.stdin.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    const body = JSON.parse(sent.slice(sent.indexOf('\r\n\r\n') + 4))
    expect(body.id).toBeUndefined()
    expect(body.method).toBe('textDocument/didOpen')
  })

  it('ignores messages with an unknown request id', async () => {
    const proc = new FakeChildProcess()
    const conn = new LspConnection(proc as any)
    // No pending request for id 999 — should not throw.
    expect(() =>
      proc.stdout.emit('data', Buffer.from(frame({ jsonrpc: '2.0', id: 999, result: {} })))
    ).not.toThrow()
  })
})
