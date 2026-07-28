import { BrowserWindow, ipcMain } from 'electron'

export type CosmosRole = 'user' | 'assistant' | 'tool'

export interface CosmosToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface CosmosMessage {
  role: CosmosRole
  content: string | null
  tool_calls?: CosmosToolCall[]
  tool_call_id?: string
}

export interface CosmosSettings {
  endpoint: string
  apiKey: string
  modelId: string
}

export interface CosmosSendPayload {
  cwd: string
  messages: CosmosMessage[]
  agentMode: boolean
  settings: CosmosSettings
}

export type CosmosEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'need-approval'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool-result'; id: string; result: string; isError: boolean }
  | { type: 'done' }
  | { type: 'error'; message: string }

interface StreamChunkDelta {
  content?: string
  tool_calls?: Array<{
    index: number
    id?: string
    function?: { name?: string; arguments?: string }
  }>
}

interface StreamChunk {
  choices: Array<{ delta: StreamChunkDelta; finish_reason: string | null }>
}

function parseSSEChunk(raw: string): StreamChunk | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('data:')) return null
  const payload = trimmed.slice('data:'.length).trim()
  if (payload === '[DONE]') return null
  try {
    return JSON.parse(payload) as StreamChunk
  } catch {
    return null
  }
}

export class CosmosManager {
  private win: BrowserWindow
  private controller: AbortController | null = null

  constructor(win: BrowserWindow) {
    this.win = win
  }

  registerHandlers(): void {
    ipcMain.on('cosmos:send', (_event, payload: CosmosSendPayload) => {
      // Returning the promise (instead of `void`-discarding it) is what lets
      // tests capture and await it via the mocked ipcMain.on handler map —
      // Electron itself ignores the return value either way.
      return this.runLoop(payload)
    })

    ipcMain.on('cosmos:cancel', () => {
      this.controller?.abort()
    })
  }

  private emit(event: CosmosEvent): void {
    this.win.webContents.send('cosmos:event', event)
  }

  private async runLoop(payload: CosmosSendPayload): Promise<void> {
    const { messages, settings } = payload
    this.controller = new AbortController()

    let response: Response
    try {
      response = await fetch(`${settings.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({ model: settings.modelId, messages, stream: true }),
        signal: this.controller.signal,
      })
    } catch (err) {
      this.emit({ type: 'error', message: `Cosmos request failed: ${(err as Error).message}` })
      return
    }

    if (!response.ok) {
      this.emit({ type: 'error', message: `Cosmos request failed: ${response.status}` })
      return
    }

    if (!response.body) {
      this.emit({ type: 'error', message: 'Cosmos response had no body' })
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const chunk = parseSSEChunk(line)
          if (!chunk) continue
          const delta = chunk.choices[0]?.delta
          if (delta?.content) {
            this.emit({ type: 'text-delta', delta: delta.content })
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.emit({ type: 'error', message: `Cosmos stream error: ${(err as Error).message}` })
      }
      return
    }

    this.emit({ type: 'done' })
  }
}
