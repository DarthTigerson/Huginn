import { BrowserWindow, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { listAllFiles, searchText, buildTree } from './fsOps'

const execFileAsync = promisify(execFile)

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

export const COSMOS_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at an absolute path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file at an absolute path, creating or overwriting it.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List the entries (files and directories) of a directory at an absolute path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search',
      description: 'Search for a text query across all files under an absolute root path.',
      parameters: {
        type: 'object',
        properties: {
          root: { type: 'string' },
          query: { type: 'string' },
          caseSensitive: { type: 'boolean' },
        },
        required: ['root', 'query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command in the project directory and capture its output.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
      },
    },
  },
] as const

const MAX_TOOL_ROUNDS = 25

interface PendingToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

interface ToolExecutionResult {
  result: string
  isError: boolean
}

export class CosmosManager {
  private win: BrowserWindow
  private controller: AbortController | null = null
  private pendingApprovals = new Map<string, (approved: boolean) => void>()

  constructor(win: BrowserWindow) {
    this.win = win
  }

  registerHandlers(): void {
    ipcMain.on('cosmos:send', (_event, payload: CosmosSendPayload) => {
      // Returning the promise (instead of `void`-discarding it) is what lets
      // tests capture and await it via the mocked ipcMain.on handler map —
      // Electron itself ignores the return value either way.
      return this.runConversation(payload)
    })

    ipcMain.on('cosmos:cancel', () => {
      this.controller?.abort()
    })

    ipcMain.on('cosmos:approve', (_event, toolCallId: string) => {
      this.pendingApprovals.get(toolCallId)?.(true)
      this.pendingApprovals.delete(toolCallId)
    })

    ipcMain.on('cosmos:reject', (_event, toolCallId: string) => {
      this.pendingApprovals.get(toolCallId)?.(false)
      this.pendingApprovals.delete(toolCallId)
    })
  }

  private emit(event: CosmosEvent): void {
    this.win.webContents.send('cosmos:event', event)
  }

  private async runConversation(payload: CosmosSendPayload): Promise<void> {
    const { cwd, settings, agentMode } = payload
    const messages = [...payload.messages]

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const streamResult = await this.streamOneCompletion(messages, settings)
      if (streamResult === null) return // error or abort already emitted

      if (streamResult.toolCalls.length === 0) {
        this.emit({ type: 'done' })
        return
      }

      messages.push({
        role: 'assistant',
        content: streamResult.content || null,
        tool_calls: streamResult.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      })

      for (const call of streamResult.toolCalls) {
        this.emit({ type: 'tool-call', id: call.id, name: call.name, args: call.args })
        const approved = agentMode ? true : await this.awaitApproval(call)
        const execResult = approved
          ? await this.executeTool(call.name, call.args, cwd)
          : { result: 'Rejected by user.', isError: true }

        this.emit({ type: 'tool-result', id: call.id, result: execResult.result, isError: execResult.isError })
        messages.push({ role: 'tool', tool_call_id: call.id, content: execResult.result })
      }
    }

    this.emit({ type: 'error', message: `Cosmos hit the ${MAX_TOOL_ROUNDS} tool-call round limit for this turn` })
  }

  private awaitApproval(call: PendingToolCall): Promise<boolean> {
    this.emit({ type: 'need-approval', id: call.id, name: call.name, args: call.args })
    return new Promise((resolve) => {
      this.pendingApprovals.set(call.id, resolve)
    })
  }

  private async executeTool(name: string, args: Record<string, unknown>, cwd: string): Promise<ToolExecutionResult> {
    try {
      switch (name) {
        case 'read_file': {
          const content = await readFile(args.path as string, 'utf-8')
          return { result: content, isError: false }
        }
        case 'write_file': {
          await writeFile(args.path as string, args.content as string, 'utf-8')
          return { result: `Wrote ${(args.content as string).length} bytes to ${args.path}`, isError: false }
        }
        case 'list_dir': {
          const entries = await buildTree(args.path as string)
          return { result: JSON.stringify(entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory }))), isError: false }
        }
        case 'search': {
          const matches = await searchText(args.root as string, args.query as string, Boolean(args.caseSensitive))
          return { result: JSON.stringify(matches), isError: false }
        }
        case 'run_command': {
          try {
            const { stdout, stderr } = await execFileAsync('/bin/zsh', ['-lc', args.command as string], {
              cwd,
              timeout: 60_000,
              maxBuffer: 10 * 1024 * 1024,
            })
            return { result: `${stdout}${stderr}`.trim() || '(no output)', isError: false }
          } catch (err) {
            const e = err as { stdout?: string; stderr?: string; message: string }
            return { result: `${e.stdout ?? ''}${e.stderr ?? ''}\n${e.message}`.trim(), isError: true }
          }
        }
        default:
          return { result: `Unknown tool: ${name}`, isError: true }
      }
    } catch (err) {
      return { result: (err as Error).message, isError: true }
    }
  }

  private async streamOneCompletion(
    messages: CosmosMessage[],
    settings: CosmosSettings
  ): Promise<{ content: string; toolCalls: PendingToolCall[] } | null> {
    this.controller = new AbortController()

    let response: Response
    try {
      response = await fetch(`${settings.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({ model: settings.modelId, messages, tools: COSMOS_TOOLS, stream: true }),
        signal: this.controller.signal,
      })
    } catch (err) {
      this.emit({ type: 'error', message: `Cosmos request failed: ${(err as Error).message}` })
      return null
    }

    if (!response.ok) {
      this.emit({ type: 'error', message: `Cosmos request failed: ${response.status}` })
      return null
    }

    if (!response.body) {
      this.emit({ type: 'error', message: 'Cosmos response had no body' })
      return null
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    const toolCallAccs: Record<number, { id: string; name: string; args: string }> = {}

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
            content += delta.content
            this.emit({ type: 'text-delta', delta: delta.content })
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const acc = toolCallAccs[tc.index] ?? { id: '', name: '', args: '' }
              if (tc.id) acc.id = tc.id
              if (tc.function?.name) acc.name = tc.function.name
              if (tc.function?.arguments) acc.args += tc.function.arguments
              toolCallAccs[tc.index] = acc
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.emit({ type: 'error', message: `Cosmos stream error: ${(err as Error).message}` })
      }
      return null
    }

    const toolCalls: PendingToolCall[] = Object.values(toolCallAccs).map((acc) => {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(acc.args || '{}')
      } catch {
        args = {}
      }
      return { id: acc.id, name: acc.name, args }
    })

    return { content, toolCalls }
  }
}
