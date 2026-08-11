import type { ChildProcessWithoutNullStreams } from 'child_process'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (err: Error) => void
}

interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string }
}

// Minimal LSP JSON-RPC client over a child process's stdio. Handles the
// `Content-Length: <n>\r\n\r\n<json>` framing the protocol uses and
// request/response correlation. Server-initiated requests/notifications
// (window/logMessage, textDocument/publishDiagnostics, ...) are read but not
// acted on — go-to-definition doesn't need them in v1.
export class LspConnection {
  private buffer = Buffer.alloc(0)
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private closed = false

  constructor(private proc: ChildProcessWithoutNullStreams) {
    this.proc.stdout.on('data', (chunk: Buffer) => this.onData(chunk))
    this.proc.on('exit', () => this.onClose())
  }

  private onClose(): void {
    if (this.closed) return
    this.closed = true
    for (const { reject } of this.pending.values()) reject(new Error('Language server exited'))
    this.pending.clear()
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    for (;;) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) return
      const header = this.buffer.subarray(0, headerEnd).toString('utf8')
      const match = /Content-Length: (\d+)/i.exec(header)
      if (!match) {
        // Malformed header — drop up to the separator and keep reading rather
        // than getting stuck on it forever.
        this.buffer = this.buffer.subarray(headerEnd + 4)
        continue
      }
      const length = parseInt(match[1], 10)
      const bodyStart = headerEnd + 4
      const bodyEnd = bodyStart + length
      if (this.buffer.length < bodyEnd) return
      const body = this.buffer.subarray(bodyStart, bodyEnd).toString('utf8')
      this.buffer = this.buffer.subarray(bodyEnd)
      this.handleMessage(body)
    }
  }

  private handleMessage(raw: string): void {
    let msg: JsonRpcMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (msg.id === undefined || (msg.result === undefined && msg.error === undefined)) return
    const pending = this.pending.get(msg.id)
    if (!pending) return
    this.pending.delete(msg.id)
    if (msg.error) pending.reject(new Error(msg.error.message ?? 'LSP error'))
    else pending.resolve(msg.result)
  }

  private write(payload: Record<string, unknown>): void {
    const json = JSON.stringify(payload)
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`
    this.proc.stdin.write(header + json)
  }

  request<T = unknown>(method: string, params: unknown, timeoutMs = 10000): Promise<T> {
    if (this.closed) return Promise.reject(new Error('Language server not running'))
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${method} timed out`))
      }, timeoutMs)
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer)
          resolve(v as T)
        },
        reject: (e) => {
          clearTimeout(timer)
          reject(e)
        },
      })
      this.write({ jsonrpc: '2.0', id, method, params })
    })
  }

  notify(method: string, params: unknown): void {
    if (this.closed) return
    this.write({ jsonrpc: '2.0', method, params })
  }

  dispose(): void {
    this.onClose()
  }
}
