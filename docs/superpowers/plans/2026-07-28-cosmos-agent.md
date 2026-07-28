# Cosmos Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cosmos — a locally-hosted, OpenAI-compatible model reached over a Thunderbolt bridge — as a third assistant in Huginn, with full agentic tool use (read/write files, list dir, search, run commands) and an approval gate that can be bypassed with a Shift+Tab "Agent Mode" toggle.

**Architecture:** `CosmosManager` (new `electron/cosmos.ts`, same manager pattern as `ClaudeManager`/`GitRunner`) owns a streaming SSE chat-completions loop against the Cosmos endpoint and executes tool calls in the main process, reusing file-op helpers extracted into `electron/fsOps.ts`. The renderer never talks to the endpoint directly — it sends messages/approvals over IPC and renders a typed event stream in a new chat-bubble panel (`CosmosChat.tsx`), distinct from the xterm-based panels Claude/Codex use.

**Tech Stack:** Electron 32 (main process, native `fetch`/`AbortController`, `child_process.execFile`), React + Zustand (renderer), Vitest + Testing Library, new dependency: `react-markdown`.

## Global Constraints

- Match existing test conventions exactly: `getByText`/`toBeTruthy()` assertions, no `jest-dom` matchers (see `docs/superpowers/plans` history: jest-dom was deliberately dropped).
- `localStorage`-backed Zustand stores follow the `gitSettingsStore.ts` pattern: a `KEYS` map of `huginn:<domain>:<field>` strings, `getBool`/`getInt`/plain `getItem` readers at init, setters that write through to `localStorage` then `set()`.
- Electron manager classes follow the `ClaudeManager`/`GitRunner` pattern: constructor takes `BrowserWindow`, exposes `registerHandlers()`, instantiated once in `main.ts`'s `app.whenReady()` block.
- Settings pages are opened as editor tabs via `settings://<Name>` paths (see `src/components/Settings/paths.ts`, `SettingsPanel.tsx`, `Editor.tsx`), not a left-sidebar panel.
- No new diff-algorithm dependency — approval previews for `write_file` show before/after content, not a computed line diff.
- Tool-call round trips are capped at 25 rounds per user message to prevent runaway loops.

---

## Task 1: Extract `electron/fsOps.ts`

`main.ts` currently defines `listAllFiles`, `searchText`, and `buildTree` as private functions backing the `fs:*` IPC handlers. `CosmosManager` needs the same logic for its `search`/`list_dir` tools, so it's extracted into a shared module first.

**Files:**
- Create: `electron/fsOps.ts`
- Modify: `electron/main.ts:1-77` (remove the three functions, import them instead)
- Test: `electron/__tests__/fsOps.test.ts`

**Interfaces:**
- Produces: `listAllFiles(dirPath: string): Promise<string[]>`, `searchText(root: string, query: string, caseSensitive: boolean): Promise<SearchMatch[]>`, `buildTree(dirPath: string): Promise<FileNode[]>`, and the `FileNode`/`SearchMatch` interfaces, all exported from `electron/fsOps.ts`.

- [ ] **Step 1: Write the failing test**

Create `electron/__tests__/fsOps.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { listAllFiles, searchText, buildTree } from '../fsOps'

describe('fsOps', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'fsops-'))
    await mkdir(join(root, 'sub'))
    await writeFile(join(root, 'a.txt'), 'hello world\nfoo bar\n')
    await writeFile(join(root, 'sub', 'b.txt'), 'HELLO again\n')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('listAllFiles recurses into subdirectories', async () => {
    const files = await listAllFiles(root)
    expect(files.sort()).toEqual([join(root, 'a.txt'), join(root, 'sub', 'b.txt')].sort())
  })

  it('searchText finds case-sensitive matches with line/col', async () => {
    const matches = await searchText(root, 'hello', true)
    expect(matches.length).toBe(1)
    expect(matches[0].path).toBe(join(root, 'a.txt'))
    expect(matches[0].line).toBe(1)
    expect(matches[0].col).toBe(1)
  })

  it('searchText is case-insensitive when caseSensitive is false', async () => {
    const matches = await searchText(root, 'hello', false)
    expect(matches.length).toBe(2)
  })

  it('buildTree lists a single directory level, directories first, sorted', async () => {
    const tree = await buildTree(root)
    expect(tree.map((n) => n.name)).toEqual(['sub', 'a.txt'])
    expect(tree[0].isDirectory).toBe(true)
    expect(tree[1].isDirectory).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/fsOps.test.ts`
Expected: FAIL — `electron/fsOps.ts` does not exist yet.

- [ ] **Step 3: Create `electron/fsOps.ts` with the extracted logic**

```typescript
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
}

export interface SearchMatch {
  path: string
  line: number
  col: number
  text: string
}

export async function listAllFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      const children = await listAllFiles(fullPath)
      results.push(...children)
    } else {
      results.push(fullPath)
    }
  }
  return results
}

export async function searchText(root: string, query: string, caseSensitive: boolean): Promise<SearchMatch[]> {
  const allFiles = await listAllFiles(root)
  const results: SearchMatch[] = []
  const needle = caseSensitive ? query : query.toLowerCase()

  for (const filePath of allFiles) {
    if (results.length >= 1000) break
    try {
      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i]
        const haystack = caseSensitive ? raw : raw.toLowerCase()
        const col = haystack.indexOf(needle)
        if (col !== -1) {
          results.push({ path: filePath, line: i + 1, col: col + 1, text: raw })
          if (results.length >= 1000) break
        }
      }
    } catch {
      // skip binary or unreadable files
    }
  }
  return results
}

export async function buildTree(dirPath: string): Promise<FileNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  return entries
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory())
        return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((e) => ({
      name: e.name,
      path: join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }))
}
```

- [ ] **Step 4: Update `electron/main.ts` to import from `fsOps.ts` instead of defining its own copies**

Replace lines 1-77 of `electron/main.ts` (imports through the end of `buildTree`) with:

```typescript
import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { access, mkdir, readFile, rename, writeFile } from 'fs/promises'
import { PtyManager } from './pty'
import { ClaudeManager } from './claude'
import { GitRunner } from './gitRunner'
import { MobileServer } from './mobile'
import { CosmosManager } from './cosmos'
import { listAllFiles, searchText, buildTree } from './fsOps'
```

(`readdir` is no longer used directly in `main.ts`, so it's dropped from the `fs/promises` import; `CosmosManager` import is added here in anticipation of Task 5 — it's fine if that import is temporarily unused/errors until Task 2 creates the file, since this whole task lands as one commit only after Task 2+ exist. For this task alone, omit the `CosmosManager` import and add it in Task 5 instead.)

Concretely, for this task, the replacement import block is:

```typescript
import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { access, mkdir, rename, writeFile } from 'fs/promises'
import { PtyManager } from './pty'
import { ClaudeManager } from './claude'
import { GitRunner } from './gitRunner'
import { MobileServer } from './mobile'
import { listAllFiles, searchText, buildTree } from './fsOps'
```

And delete the now-duplicated `FileNode`/`SearchMatch` interfaces and the `listAllFiles`/`searchText`/`buildTree` function bodies (previously lines 10-77), leaving `registerFsHandlers` (previously starting at line 79) as the first function in the file, unchanged — it already calls `buildTree`/`listAllFiles`/`searchText` by name.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/fsOps.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Typecheck to confirm `main.ts` still compiles**

Run: `npx tsc -p tsconfig.node.json --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add electron/fsOps.ts electron/main.ts electron/__tests__/fsOps.test.ts
git commit -m "refactor: extract fsOps.ts from main.ts for reuse by CosmosManager"
```

---

## Task 2: `electron/cosmos.ts` — SSE streaming loop (text only, no tools yet)

Build the core streaming plumbing first, without tool calls, so the SSE parsing/accumulation logic is tested in isolation before the more complex tool-call branch is layered on in Task 3.

**Files:**
- Create: `electron/cosmos.ts`
- Test: `electron/__tests__/cosmos.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks yet (fetch is globally available in Electron's main process / Node 20).
- Produces: `CosmosManager` class with `constructor(win: BrowserWindow)`, `registerHandlers(): void`. Types: `CosmosMessage`, `CosmosSettings`, `CosmosEvent` (all exported). `ipcMain` channels: `cosmos:send` (on), `cosmos:cancel` (on). Emits `win.webContents.send('cosmos:event', event: CosmosEvent)`.

- [ ] **Step 1: Write the failing test**

Create `electron/__tests__/cosmos.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: FAIL — `electron/cosmos.ts` does not exist yet.

- [ ] **Step 3: Implement `electron/cosmos.ts` (streaming loop, no tools)**

```typescript
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
      void this.runLoop(payload)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add electron/cosmos.ts electron/__tests__/cosmos.test.ts
git commit -m "feat: add CosmosManager with SSE streaming chat loop (text only)"
```

---

## Task 3: `electron/cosmos.ts` — tool calling, approval gate, agent mode

Extend `CosmosManager` with the fixed tool set, tool-call accumulation from the delta stream, the approval gate, and the multi-round loop.

**Files:**
- Modify: `electron/cosmos.ts`
- Test: `electron/__tests__/cosmos.test.ts`

**Interfaces:**
- Consumes: `listAllFiles`, `searchText`, `buildTree` from `electron/fsOps.ts` (Task 1).
- Produces: `ipcMain` channels `cosmos:approve` (on), `cosmos:reject` (on), both taking a `toolCallId: string`. Exported `COSMOS_TOOLS` constant (the JSON-schema tool definitions sent to the endpoint).

- [ ] **Step 1: Write the failing tests**

Append to `electron/__tests__/cosmos.test.ts`:

```typescript
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
    const fetchMock = vi.fn().mockResolvedValue(toolCallStream('run_command', { command: 'echo loop' }))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'loop forever' }], agentMode: true, settings: SETTINGS })

    expect(fetchMock).toHaveBeenCalledTimes(25)
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events[events.length - 1]).toEqual({ type: 'error', message: 'Cosmos hit the 25 tool-call round limit for this turn' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: FAIL — no tool-calling support yet.

- [ ] **Step 3: Implement tool calling in `electron/cosmos.ts`**

Replace the contents of `electron/cosmos.ts` with the Task 2 version plus these additions (full file):

```typescript
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
      void this.runConversation(payload)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: PASS (all tests in the file, text-only + tool-calling)

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.node.json --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add electron/cosmos.ts electron/__tests__/cosmos.test.ts
git commit -m "feat: add tool calling, approval gate, and agent mode to CosmosManager"
```

---

## Task 4: `cosmos:testConnection` handler

**Files:**
- Modify: `electron/cosmos.ts`
- Test: `electron/__tests__/cosmos.test.ts`

**Interfaces:**
- Produces: `ipcMain.handle('cosmos:testConnection', (settings: CosmosSettings) => Promise<{ ok: boolean; error?: string }>)`.

- [ ] **Step 1: Write the failing test**

Append to `electron/__tests__/cosmos.test.ts`:

```typescript
describe('CosmosManager cosmos:testConnection', () => {
  beforeEach(() => vi.restoreAllMocks())

  function setup() {
    const win = { webContents: { send: vi.fn() } } as any
    const manager = new CosmosManager(win)
    manager.registerHandlers()
    return handlers['cosmos:testConnection']
  }

  it('returns ok:true when the endpoint responds with 200', async () => {
    const testHandler = setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))

    const result = await testHandler({}, SETTINGS)
    expect(result).toEqual({ ok: true })
  })

  it('returns ok:false with an error message on failure', async () => {
    const testHandler = setup()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')))

    const result = await testHandler({}, SETTINGS)
    expect(result).toEqual({ ok: false, error: 'connect ECONNREFUSED' })
  })

  it('returns ok:false with the status code on a non-2xx response', async () => {
    const testHandler = setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })))

    const result = await testHandler({}, SETTINGS)
    expect(result).toEqual({ ok: false, error: 'HTTP 401' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: FAIL — no `cosmos:testConnection` handler registered.

- [ ] **Step 3: Add the handler**

In `electron/cosmos.ts`, inside `registerHandlers()`, add:

```typescript
    ipcMain.handle('cosmos:testConnection', async (_event, settings: CosmosSettings) => {
      try {
        const response = await fetch(`${settings.endpoint}/models`, {
          headers: { Authorization: `Bearer ${settings.apiKey}` },
        })
        if (!response.ok) return { ok: false, error: `HTTP ${response.status}` }
        return { ok: true }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add electron/cosmos.ts electron/__tests__/cosmos.test.ts
git commit -m "feat: add cosmos:testConnection handler"
```

---

## Task 5: Wire the IPC surface — `main.ts`, `preload.ts`, `src/types/api.d.ts`

Connect `CosmosManager` into the app and expose its channels to the renderer.

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/api.d.ts`

**Interfaces:**
- Consumes: `CosmosManager`, `CosmosMessage`, `CosmosSettings`, `CosmosEvent` from `electron/cosmos.ts` (Tasks 2-4).
- Produces: `window.api.cosmosSend`, `cosmosApprove`, `cosmosReject`, `cosmosCancel`, `cosmosTestConnection`, `onCosmosEvent` — the renderer-facing surface every later task builds on. `AssistantKind` widened to `'claude' | 'codex' | 'cosmos'`.

- [ ] **Step 1: Add the `CosmosManager` import and instantiation to `main.ts`**

In `electron/main.ts`, add to the import block (from Task 1):

```typescript
import { CosmosManager } from './cosmos'
```

In `app.whenReady().then(...)`, after `mobileSrv.registerHandlers()`:

```typescript
  const cosmosMgr = new CosmosManager(win)
  cosmosMgr.registerHandlers()
```

- [ ] **Step 2: Duplicate the Cosmos types into `src/types/api.d.ts`**

`src/types/api.d.ts` cannot import from `electron/` (separate tsconfig project — see how `MobileState` is duplicated rather than imported). Add, near the existing `MobileState` interface:

```typescript
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

export type CosmosEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'need-approval'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool-result'; id: string; result: string; isError: boolean }
  | { type: 'done' }
  | { type: 'error'; message: string }
```

Change:

```typescript
export type AssistantKind = 'claude' | 'codex'
```

to:

```typescript
export type AssistantKind = 'claude' | 'codex' | 'cosmos'
```

- [ ] **Step 3: Add the Cosmos surface to `Window.api` in `src/types/api.d.ts`**

Inside the `interface Window { interface api { ... } }` block, after the `onMobileState` entry:

```typescript
      cosmosSend: (cwd: string, messages: CosmosMessage[], agentMode: boolean, settings: CosmosSettings) => void
      cosmosApprove: (toolCallId: string) => void
      cosmosReject: (toolCallId: string) => void
      cosmosCancel: () => void
      cosmosTestConnection: (settings: CosmosSettings) => Promise<{ ok: boolean; error?: string }>
      onCosmosEvent: (cb: (event: CosmosEvent) => void) => () => void
```

- [ ] **Step 4: Expose the channels in `electron/preload.ts`**

Add, after the `onMobileState` block:

```typescript
  cosmosSend: (cwd: string, messages: unknown[], agentMode: boolean, settings: unknown) =>
    ipcRenderer.send('cosmos:send', { cwd, messages, agentMode, settings }),
  cosmosApprove: (toolCallId: string) => ipcRenderer.send('cosmos:approve', toolCallId),
  cosmosReject: (toolCallId: string) => ipcRenderer.send('cosmos:reject', toolCallId),
  cosmosCancel: () => ipcRenderer.send('cosmos:cancel'),
  cosmosTestConnection: (settings: unknown) => ipcRenderer.invoke('cosmos:testConnection', settings),
  onCosmosEvent: (cb: (event: import('./cosmos').CosmosEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: import('./cosmos').CosmosEvent) => cb(event)
    ipcRenderer.on('cosmos:event', handler)
    return () => ipcRenderer.removeListener('cosmos:event', handler)
  },
```

- [ ] **Step 5: Typecheck both projects**

Run: `npx tsc -p tsconfig.node.json --noEmit && npx tsc -p tsconfig.web.json --noEmit`
Expected: no errors. (`AssistantKind` widening to include `'cosmos'` must not break `claudeStore.ts` or `Chat.tsx` — at this point in the plan those files still only handle `'claude' | 'codex'` explicitly, which remains valid since TypeScript won't complain about an unhandled union member unless there's an exhaustiveness check; there isn't one yet, so this passes. Tasks 8/10/11 make those files `'cosmos'`-aware.)

- [ ] **Step 6: Commit**

```bash
git add electron/main.ts electron/preload.ts src/types/api.d.ts
git commit -m "feat: wire CosmosManager into main process and expose IPC surface to renderer"
```

---

## Task 6: `src/stores/cosmosSettingsStore.ts`

**Files:**
- Create: `src/stores/cosmosSettingsStore.ts`
- Test: `src/stores/__tests__/cosmosSettingsStore.test.ts`

**Interfaces:**
- Produces: `useCosmosSettingsStore` with `endpoint: string`, `apiKey: string`, `modelId: string`, `setEndpoint`, `setApiKey`, `setModelId`.

- [ ] **Step 1: Write the failing test**

Create `src/stores/__tests__/cosmosSettingsStore.test.ts` (mirrors `gitSettingsStore.test.ts`):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  return { store }
})

import { useCosmosSettingsStore } from '../cosmosSettingsStore'

describe('cosmosSettingsStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    useCosmosSettingsStore.setState({ endpoint: '', apiKey: '', modelId: '' })
  })

  it('has empty defaults', () => {
    const s = useCosmosSettingsStore.getState()
    expect(s.endpoint).toBe('')
    expect(s.apiKey).toBe('')
    expect(s.modelId).toBe('')
  })

  it('setEndpoint persists to localStorage', () => {
    useCosmosSettingsStore.getState().setEndpoint('http://169.254.238.138:8002/v1')
    expect(useCosmosSettingsStore.getState().endpoint).toBe('http://169.254.238.138:8002/v1')
    expect(store['huginn:cosmos:endpoint']).toBe('http://169.254.238.138:8002/v1')
  })

  it('setApiKey persists to localStorage', () => {
    useCosmosSettingsStore.getState().setApiKey('local')
    expect(store['huginn:cosmos:apiKey']).toBe('local')
  })

  it('setModelId persists to localStorage', () => {
    useCosmosSettingsStore.getState().setModelId('mlx-community/Qwen2.5-Coder-32B')
    expect(store['huginn:cosmos:modelId']).toBe('mlx-community/Qwen2.5-Coder-32B')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/__tests__/cosmosSettingsStore.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the store**

```typescript
import { create } from 'zustand'

const KEYS = {
  endpoint: 'huginn:cosmos:endpoint',
  apiKey:   'huginn:cosmos:apiKey',
  modelId:  'huginn:cosmos:modelId',
}

function getString(key: string, def: string): string {
  const v = localStorage.getItem(key)
  return v === null ? def : v
}

interface CosmosSettingsStore {
  endpoint: string
  apiKey: string
  modelId: string
  setEndpoint: (v: string) => void
  setApiKey: (v: string) => void
  setModelId: (v: string) => void
}

export const useCosmosSettingsStore = create<CosmosSettingsStore>((set) => ({
  endpoint: getString(KEYS.endpoint, ''),
  apiKey:   getString(KEYS.apiKey, ''),
  modelId:  getString(KEYS.modelId, ''),

  setEndpoint: (v) => {
    localStorage.setItem(KEYS.endpoint, v)
    set({ endpoint: v })
  },
  setApiKey: (v) => {
    localStorage.setItem(KEYS.apiKey, v)
    set({ apiKey: v })
  },
  setModelId: (v) => {
    localStorage.setItem(KEYS.modelId, v)
    set({ modelId: v })
  },
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stores/__tests__/cosmosSettingsStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/cosmosSettingsStore.ts src/stores/__tests__/cosmosSettingsStore.test.ts
git commit -m "feat: add cosmosSettingsStore for endpoint/apiKey/modelId"
```

---

## Task 7: `CosmosSettingsPage` + Settings navigation wiring

**Files:**
- Create: `src/components/Settings/CosmosSettingsPage.tsx`
- Modify: `src/components/Settings/paths.ts`
- Modify: `src/components/Settings/SettingsPanel.tsx`
- Modify: `src/components/Editor/Editor.tsx`
- Test: `src/components/Settings/__tests__/CosmosSettingsPage.test.tsx`

**Interfaces:**
- Consumes: `useCosmosSettingsStore` (Task 6), `window.api.cosmosTestConnection` (Task 5).
- Produces: `COSMOS_SETTINGS_TAB_PATH` exported from `paths.ts`.

- [ ] **Step 1: Add the tab path constant**

In `src/components/Settings/paths.ts`, add:

```typescript
export const COSMOS_SETTINGS_TAB_PATH = 'settings://Cosmos'
```

- [ ] **Step 2: Write the failing component test**

Create `src/components/Settings/__tests__/CosmosSettingsPage.test.tsx`:

```typescript
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CosmosSettingsPage } from '../CosmosSettingsPage'
import { useCosmosSettingsStore } from '@/stores/cosmosSettingsStore'

afterEach(() => {
  cleanup()
  useCosmosSettingsStore.setState({ endpoint: '', apiKey: '', modelId: '' })
})

describe('CosmosSettingsPage', () => {
  it('renders current settings values', () => {
    useCosmosSettingsStore.setState({ endpoint: 'http://host:8002/v1', apiKey: 'local', modelId: 'test-model' })
    render(<CosmosSettingsPage />)

    expect((screen.getByLabelText('Endpoint') as HTMLInputElement).value).toBe('http://host:8002/v1')
    expect((screen.getByLabelText('API Key') as HTMLInputElement).value).toBe('local')
    expect((screen.getByLabelText('Model ID') as HTMLInputElement).value).toBe('test-model')
  })

  it('updates the store when a field changes', () => {
    render(<CosmosSettingsPage />)
    fireEvent.change(screen.getByLabelText('Endpoint'), { target: { value: 'http://new:8002/v1' } })
    expect(useCosmosSettingsStore.getState().endpoint).toBe('http://new:8002/v1')
  })

  it('shows a success message when the test connection succeeds', async () => {
    ;(global as any).window.api = { cosmosTestConnection: vi.fn().mockResolvedValue({ ok: true }) }
    render(<CosmosSettingsPage />)

    fireEvent.click(screen.getByText('Test Connection'))

    await waitFor(() => expect(screen.getByText('Connected')).toBeTruthy())
  })

  it('shows an error message when the test connection fails', async () => {
    ;(global as any).window.api = { cosmosTestConnection: vi.fn().mockResolvedValue({ ok: false, error: 'HTTP 401' }) }
    render(<CosmosSettingsPage />)

    fireEvent.click(screen.getByText('Test Connection'))

    await waitFor(() => expect(screen.getByText('HTTP 401')).toBeTruthy())
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/Settings/__tests__/CosmosSettingsPage.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 4: Implement `CosmosSettingsPage.tsx`**

```typescript
import { useState } from 'react'
import { useCosmosSettingsStore } from '@/stores/cosmosSettingsStore'

function Field({ id, label, value, onChange, type = 'text' }: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-fg">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded border border-border bg-panel px-2 text-sm text-fg outline-none focus:border-accent"
      />
    </div>
  )
}

export function CosmosSettingsPage() {
  const { endpoint, apiKey, modelId, setEndpoint, setApiKey, setModelId } = useCosmosSettingsStore()
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  const runTest = async () => {
    setTestState('testing')
    const result = await window.api.cosmosTestConnection({ endpoint, apiKey, modelId })
    if (result.ok) {
      setTestState('ok')
    } else {
      setTestState('error')
      setTestError(result.error ?? 'Unknown error')
    }
  }

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">Cosmos</h1>
      <p className="text-sm text-fg-muted mb-8">Connection settings for the Cosmos agent, reached over the Thunderbolt bridge.</p>

      <div className="grid grid-cols-1 gap-5 max-w-lg">
        <Field id="cosmos-endpoint" label="Endpoint" value={endpoint} onChange={setEndpoint} />
        <Field id="cosmos-apikey" label="API Key" value={apiKey} onChange={setApiKey} />
        <Field id="cosmos-model" label="Model ID" value={modelId} onChange={setModelId} />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={runTest}
            disabled={testState === 'testing'}
            className="h-8 px-3 rounded border border-border text-sm text-fg hover:border-fg-subtle transition-colors disabled:opacity-50"
          >
            Test Connection
          </button>
          {testState === 'ok' && <span className="text-sm text-green-500">Connected</span>}
          {testState === 'error' && <span className="text-sm text-red-500">{testError}</span>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/Settings/__tests__/CosmosSettingsPage.test.tsx`
Expected: PASS

- [ ] **Step 6: Wire the page into `SettingsPanel.tsx`**

In `src/components/Settings/SettingsPanel.tsx`, add `COSMOS_SETTINGS_TAB_PATH` to the import from `./paths`, add an `isCosmosActive` check, and add a fourth button matching the existing three (Display/Editor/Git):

```typescript
import { DISPLAY_TAB_PATH, EDITOR_SETTINGS_TAB_PATH, GIT_SETTINGS_TAB_PATH, COSMOS_SETTINGS_TAB_PATH } from './paths'
```

```typescript
  const isCosmosActive = activeTabPath === COSMOS_SETTINGS_TAB_PATH
```

```typescript
        <button
          type="button"
          onClick={() =>
            useEditorStore.getState().openTab({
              path: COSMOS_SETTINGS_TAB_PATH,
              content: '',
              dirty: false,
            })
          }
          className={[
            'w-full text-left px-3 py-1.5 text-sm transition-colors',
            isCosmosActive ? 'bg-accent/10 text-fg' : 'text-fg hover:bg-white/5',
          ].join(' ')}
        >
          Cosmos
        </button>
```

(placed after the Git button, before the closing `</div>`)

- [ ] **Step 7: Wire the page into `Editor.tsx`**

In `src/components/Editor/Editor.tsx`, add the import:

```typescript
import { CosmosSettingsPage } from '@/components/Settings/CosmosSettingsPage'
```

And add a branch before the final `DisplayPage` fallback in the `isVirtual` ternary chain (around line 263-271):

```typescript
          activeTab.path === GIT_SETTINGS_TAB_PATH ? (
            <GitSettingsPage />
          ) : activeTab.path === EDITOR_SETTINGS_TAB_PATH ? (
            <EditorSettingsPage />
          ) : activeTab.path === COSMOS_SETTINGS_TAB_PATH ? (
            <CosmosSettingsPage />
          ) : activeTab.path === DISPLAY_TAB_PATH ? (
            <DisplayPage />
          ) : (
            <DisplayPage />
          )
```

Also add `COSMOS_SETTINGS_TAB_PATH` to Editor.tsx's existing import from `./paths` (or `@/components/Settings/paths`, matching whatever the existing `GIT_SETTINGS_TAB_PATH` import uses).

- [ ] **Step 8: Run the full test suite to check nothing broke**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/components/Settings/CosmosSettingsPage.tsx src/components/Settings/paths.ts src/components/Settings/SettingsPanel.tsx src/components/Editor/Editor.tsx src/components/Settings/__tests__/CosmosSettingsPage.test.tsx
git commit -m "feat: add Cosmos settings page (endpoint/apiKey/modelId + test connection)"
```

---

## Task 8: `src/stores/cosmosStore.ts` — conversation state

**Files:**
- Create: `src/stores/cosmosStore.ts`
- Test: `src/stores/__tests__/cosmosStore.test.ts`

**Interfaces:**
- Consumes: `window.api.cosmosSend/cosmosApprove/cosmosReject/cosmosCancel/onCosmosEvent` (Task 5), `useCosmosSettingsStore` (Task 6), `CosmosMessage`/`CosmosEvent` types (`@/types/api`).
- Produces: `useCosmosStore` with:
  - `messages: CosmosChatMessage[]` (renderer-side shape, richer than `CosmosMessage` — includes tool-call block status for rendering)
  - `agentMode: boolean` (persisted to `localStorage` key `huginn:cosmos:agentMode`)
  - `streaming: boolean`
  - `sendMessage(cwd: string, text: string): void`
  - `newSession(): void`
  - `previousSession(): void`
  - `toggleAgentMode(): void`
  - `approveToolCall(id: string): void`
  - `rejectToolCall(id: string): void`
  - `cancel(): void`
  - `initEventListener(): () => void` (subscribes to `onCosmosEvent` once; called from `CosmosChat` on mount)

- [ ] **Step 1: Write the failing test**

Create `src/stores/__tests__/cosmosStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store, apiMock } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  const apiMock = {
    cosmosSend: vi.fn(),
    cosmosApprove: vi.fn(),
    cosmosReject: vi.fn(),
    cosmosCancel: vi.fn(),
    onCosmosEvent: vi.fn(() => () => {}),
  }
  ;(global as any).window = { api: apiMock }
  return { store, apiMock }
})

import { useCosmosStore } from '../cosmosStore'

describe('cosmosStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    vi.clearAllMocks()
    useCosmosStore.setState({ messages: [], previousMessages: [], agentMode: false, streaming: false })
  })

  it('sendMessage appends a user message and calls window.api.cosmosSend', () => {
    useCosmosStore.getState().sendMessage('/project', 'hello')

    const state = useCosmosStore.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0]).toMatchObject({ role: 'user', content: 'hello' })
    expect(state.streaming).toBe(true)
    expect(apiMock.cosmosSend).toHaveBeenCalledWith('/project', [{ role: 'user', content: 'hello' }], false, expect.any(Object))
  })

  it('toggleAgentMode flips and persists agentMode', () => {
    useCosmosStore.getState().toggleAgentMode()
    expect(useCosmosStore.getState().agentMode).toBe(true)
    expect(store['huginn:cosmos:agentMode']).toBe('true')
  })

  it('newSession moves current messages to previousMessages and clears the transcript', () => {
    useCosmosStore.setState({ messages: [{ role: 'user', content: 'hi', status: 'done' } as any] })
    useCosmosStore.getState().newSession()

    const state = useCosmosStore.getState()
    expect(state.messages).toEqual([])
    expect(state.previousMessages).toHaveLength(1)
  })

  it('previousSession restores the saved transcript', () => {
    useCosmosStore.setState({ previousMessages: [{ role: 'user', content: 'old', status: 'done' } as any] })
    useCosmosStore.getState().previousSession()

    expect(useCosmosStore.getState().messages).toEqual([{ role: 'user', content: 'old', status: 'done' }])
  })

  it('approveToolCall/rejectToolCall delegate to window.api', () => {
    useCosmosStore.getState().approveToolCall('call_1')
    useCosmosStore.getState().rejectToolCall('call_2')
    expect(apiMock.cosmosApprove).toHaveBeenCalledWith('call_1')
    expect(apiMock.cosmosReject).toHaveBeenCalledWith('call_2')
  })

  it('handles a text-delta event by appending to the in-progress assistant message', () => {
    let handler: (e: any) => void = () => {}
    apiMock.onCosmosEvent.mockImplementation((cb) => { handler = cb; return () => {} })
    useCosmosStore.getState().initEventListener()

    useCosmosStore.getState().sendMessage('/project', 'hi')
    handler({ type: 'text-delta', delta: 'Hel' })
    handler({ type: 'text-delta', delta: 'lo' })

    const messages = useCosmosStore.getState().messages
    expect(messages[messages.length - 1]).toMatchObject({ role: 'assistant', content: 'Hello' })
  })

  it('handles a done event by clearing streaming state', () => {
    let handler: (e: any) => void = () => {}
    apiMock.onCosmosEvent.mockImplementation((cb) => { handler = cb; return () => {} })
    useCosmosStore.getState().initEventListener()

    useCosmosStore.getState().sendMessage('/project', 'hi')
    handler({ type: 'done' })

    expect(useCosmosStore.getState().streaming).toBe(false)
  })

  it('handles need-approval by adding a pending tool-call block to the assistant message', () => {
    let handler: (e: any) => void = () => {}
    apiMock.onCosmosEvent.mockImplementation((cb) => { handler = cb; return () => {} })
    useCosmosStore.getState().initEventListener()

    useCosmosStore.getState().sendMessage('/project', 'hi')
    handler({ type: 'tool-call', id: 'call_1', name: 'write_file', args: { path: '/x' } })
    handler({ type: 'need-approval', id: 'call_1', name: 'write_file', args: { path: '/x' } })

    const messages = useCosmosStore.getState().messages
    const assistantMsg = messages[messages.length - 1]
    expect(assistantMsg.toolCalls?.[0]).toMatchObject({ id: 'call_1', name: 'write_file', status: 'pending-approval' })
  })

  it('handles tool-result by updating the matching tool-call block to done/error', () => {
    let handler: (e: any) => void = () => {}
    apiMock.onCosmosEvent.mockImplementation((cb) => { handler = cb; return () => {} })
    useCosmosStore.getState().initEventListener()

    useCosmosStore.getState().sendMessage('/project', 'hi')
    handler({ type: 'tool-call', id: 'call_1', name: 'write_file', args: { path: '/x' } })
    handler({ type: 'tool-result', id: 'call_1', result: 'Wrote 2 bytes', isError: false })

    const messages = useCosmosStore.getState().messages
    const assistantMsg = messages[messages.length - 1]
    expect(assistantMsg.toolCalls?.[0]).toMatchObject({ id: 'call_1', status: 'done', result: 'Wrote 2 bytes' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/__tests__/cosmosStore.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `cosmosStore.ts`**

```typescript
import { create } from 'zustand'
import { useCosmosSettingsStore } from './cosmosSettingsStore'
import type { CosmosEvent, CosmosMessage } from '@/types/api'

const AGENT_MODE_KEY = 'huginn:cosmos:agentMode'

export interface CosmosToolCallBlock {
  id: string
  name: string
  args: Record<string, unknown>
  status: 'pending-approval' | 'running' | 'done' | 'error'
  result?: string
}

export interface CosmosChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: CosmosToolCallBlock[]
}

function getAgentMode(): boolean {
  return localStorage.getItem(AGENT_MODE_KEY) === 'true'
}

function toWireMessages(messages: CosmosChatMessage[]): CosmosMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }))
}

interface CosmosStore {
  messages: CosmosChatMessage[]
  previousMessages: CosmosChatMessage[]
  agentMode: boolean
  streaming: boolean
  sendMessage: (cwd: string, text: string) => void
  newSession: () => void
  previousSession: () => void
  toggleAgentMode: () => void
  approveToolCall: (id: string) => void
  rejectToolCall: (id: string) => void
  cancel: () => void
  initEventListener: () => () => void
}

export const useCosmosStore = create<CosmosStore>((set, get) => ({
  messages: [],
  previousMessages: [],
  agentMode: getAgentMode(),
  streaming: false,

  sendMessage: (cwd, text) => {
    const userMessage: CosmosChatMessage = { role: 'user', content: text }
    const messages = [...get().messages, userMessage]
    set({ messages, streaming: true })

    const settings = useCosmosSettingsStore.getState()
    window.api.cosmosSend(cwd, toWireMessages(messages), get().agentMode, {
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      modelId: settings.modelId,
    })
  },

  newSession: () => {
    set((s) => ({ previousMessages: s.messages, messages: [] }))
  },

  previousSession: () => {
    set((s) => ({ messages: s.previousMessages }))
  },

  toggleAgentMode: () => {
    const next = !get().agentMode
    localStorage.setItem(AGENT_MODE_KEY, String(next))
    set({ agentMode: next })
  },

  approveToolCall: (id) => window.api.cosmosApprove(id),
  rejectToolCall: (id) => window.api.cosmosReject(id),
  cancel: () => {
    window.api.cosmosCancel()
    set({ streaming: false })
  },

  initEventListener: () => {
    return window.api.onCosmosEvent((event: CosmosEvent) => {
      handleEvent(event, set, get)
    })
  },
}))

function ensureAssistantMessage(messages: CosmosChatMessage[]): CosmosChatMessage[] {
  const last = messages[messages.length - 1]
  if (last && last.role === 'assistant') return messages
  return [...messages, { role: 'assistant', content: '' }]
}

function handleEvent(
  event: CosmosEvent,
  set: (partial: Partial<CosmosStore>) => void,
  get: () => CosmosStore
): void {
  const messages = ensureAssistantMessage(get().messages)
  const last = { ...messages[messages.length - 1] }

  switch (event.type) {
    case 'text-delta': {
      last.content += event.delta
      set({ messages: [...messages.slice(0, -1), last] })
      return
    }
    case 'tool-call': {
      last.toolCalls = [...(last.toolCalls ?? []), { id: event.id, name: event.name, args: event.args, status: 'running' }]
      set({ messages: [...messages.slice(0, -1), last] })
      return
    }
    case 'need-approval': {
      last.toolCalls = (last.toolCalls ?? []).map((tc) =>
        tc.id === event.id ? { ...tc, status: 'pending-approval' as const } : tc
      )
      set({ messages: [...messages.slice(0, -1), last] })
      return
    }
    case 'tool-result': {
      last.toolCalls = (last.toolCalls ?? []).map((tc) =>
        tc.id === event.id ? { ...tc, status: event.isError ? ('error' as const) : ('done' as const), result: event.result } : tc
      )
      set({ messages: [...messages.slice(0, -1), last] })
      return
    }
    case 'done': {
      set({ streaming: false })
      return
    }
    case 'error': {
      last.content += `\n\n**Error:** ${event.message}`
      set({ messages: [...messages.slice(0, -1), last], streaming: false })
      return
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stores/__tests__/cosmosStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/cosmosStore.ts src/stores/__tests__/cosmosStore.test.ts
git commit -m "feat: add cosmosStore for conversation state and event handling"
```

---

## Task 9: `react-markdown` dependency + `CosmosChat.tsx`

**Files:**
- Modify: `package.json` (add `react-markdown`)
- Create: `src/components/Chat/CosmosChat.tsx`
- Test: `src/components/Chat/__tests__/CosmosChat.test.tsx`

**Interfaces:**
- Consumes: `useCosmosStore` (Task 8).
- Produces: `<CosmosChat cwd={string} />` component, rendered by `Chat.tsx` in Task 10.

- [ ] **Step 1: Add the dependency**

Run: `npm install react-markdown`

- [ ] **Step 2: Write the failing component test**

Create `src/components/Chat/__tests__/CosmosChat.test.tsx`:

```typescript
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CosmosChat } from '../CosmosChat'
import { useCosmosStore } from '@/stores/cosmosStore'

beforeEach(() => {
  ;(global as any).window.api = {
    ...(global as any).window.api,
    onCosmosEvent: vi.fn(() => () => {}),
    cosmosSend: vi.fn(),
    cosmosApprove: vi.fn(),
    cosmosReject: vi.fn(),
  }
  useCosmosStore.setState({ messages: [], previousMessages: [], streaming: false, agentMode: false })
})

afterEach(() => cleanup())

describe('CosmosChat', () => {
  it('renders user and assistant message bubbles', () => {
    useCosmosStore.setState({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
    })
    render(<CosmosChat cwd="/project" />)

    expect(screen.getByText('hello')).toBeTruthy()
    expect(screen.getByText('hi there')).toBeTruthy()
  })

  it('renders a pending-approval tool-call block with Approve/Reject buttons', () => {
    useCosmosStore.setState({
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'write_file', args: { path: '/x' }, status: 'pending-approval' }],
        },
      ],
    })
    render(<CosmosChat cwd="/project" />)

    expect(screen.getByText('write_file')).toBeTruthy()
    expect(screen.getByText('Approve')).toBeTruthy()
    expect(screen.getByText('Reject')).toBeTruthy()
  })

  it('calls approveToolCall when Approve is clicked', () => {
    useCosmosStore.setState({
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'write_file', args: { path: '/x' }, status: 'pending-approval' }],
        },
      ],
    })
    render(<CosmosChat cwd="/project" />)

    fireEvent.click(screen.getByText('Approve'))
    expect((global as any).window.api.cosmosApprove).toHaveBeenCalledWith('call_1')
  })

  it('sends a message on submit and clears the input', () => {
    render(<CosmosChat cwd="/project" />)

    const input = screen.getByPlaceholderText('Message Cosmos…') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'do the thing' } })
    fireEvent.submit(input.closest('form')!)

    expect((global as any).window.api.cosmosSend).toHaveBeenCalled()
    expect(input.value).toBe('')
  })

  it('shows an Agent Mode indicator reflecting the store', () => {
    useCosmosStore.setState({ agentMode: true })
    render(<CosmosChat cwd="/project" />)

    expect(screen.getByText('Agent Mode')).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/Chat/__tests__/CosmosChat.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 4: Implement `CosmosChat.tsx`**

```typescript
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useCosmosStore, type CosmosToolCallBlock } from '@/stores/cosmosStore'

function ToolCallBlock({ block }: { block: CosmosToolCallBlock }) {
  const [expanded, setExpanded] = useState(false)
  const approveToolCall = useCosmosStore((s) => s.approveToolCall)
  const rejectToolCall = useCosmosStore((s) => s.rejectToolCall)

  const statusLabel = {
    'pending-approval': 'Waiting for approval',
    running: 'Running…',
    done: 'Done',
    error: 'Failed',
  }[block.status]

  return (
    <div className="rounded border border-border/60 px-2 py-1.5 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-mono text-fg">{block.name}</span>
        <span className="text-fg-muted">{statusLabel}</span>
      </button>

      {block.status === 'pending-approval' && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => approveToolCall(block.id)}
            className="h-6 px-2 rounded bg-accent/20 text-fg hover:bg-accent/30"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => rejectToolCall(block.id)}
            className="h-6 px-2 rounded border border-border text-fg-muted hover:text-fg"
          >
            Reject
          </button>
        </div>
      )}

      {expanded && (
        <pre className="mt-2 whitespace-pre-wrap text-fg-muted">
          {JSON.stringify(block.args, null, 2)}
          {block.result ? `\n\n${block.result}` : ''}
        </pre>
      )}
    </div>
  )
}

export function CosmosChat({ cwd }: { cwd: string }) {
  const messages = useCosmosStore((s) => s.messages)
  const agentMode = useCosmosStore((s) => s.agentMode)
  const streaming = useCosmosStore((s) => s.streaming)
  const sendMessage = useCosmosStore((s) => s.sendMessage)
  const toggleAgentMode = useCosmosStore((s) => s.toggleAgentMode)
  const initEventListener = useCosmosStore((s) => s.initEventListener)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => initEventListener(), [initEventListener])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || streaming) return
    sendMessage(cwd, input)
    setInput('')
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-7 px-2 flex items-center justify-end shrink-0 border-b border-border/60">
        {agentMode && <span className="text-xs text-accent">Agent Mode</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'self-end max-w-[85%]' : 'self-start max-w-[90%]'}>
            <div
              className={[
                'rounded-lg px-3 py-2 text-sm',
                m.role === 'user' ? 'bg-accent/15 text-fg' : 'bg-white/5 text-fg',
              ].join(' ')}
            >
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
            {m.toolCalls && m.toolCalls.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-1.5">
                {m.toolCalls.map((tc) => (
                  <ToolCallBlock key={tc.id} block={tc} />
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="border-t border-border/60 p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit(e)
            }
          }}
          placeholder="Message Cosmos…"
          rows={2}
          className="w-full resize-none rounded border border-border bg-panel px-2 py-1.5 text-sm text-fg outline-none focus:border-accent"
        />
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/Chat/__tests__/CosmosChat.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/Chat/CosmosChat.tsx src/components/Chat/__tests__/CosmosChat.test.tsx
git commit -m "feat: add CosmosChat panel with markdown rendering and tool-call blocks"
```

---

## Task 10: `Chat.tsx` — branch to `CosmosChat` for the cosmos assistant

**Files:**
- Modify: `src/components/Chat/Chat.tsx`

**Interfaces:**
- Consumes: `CosmosChat` (Task 9).

- [ ] **Step 1: Guard the pty-terminal effects against `assistant === 'cosmos'`**

In `src/components/Chat/Chat.tsx`, the effect starting at line 52 (`useEffect(() => { if (!projectRoot || !containerRef.current) return ...`) creates/shows pty terminals for whichever assistant is active. Change its guard so it's a no-op when Cosmos is active:

```typescript
  useEffect(() => {
    if (!projectRoot || !containerRef.current || assistant === 'cosmos') return
    // ...unchanged body...
  }, [projectRoot, assistant])
```

Do the same for the resize `ResizeObserver` effect (starting at line 118):

```typescript
  useEffect(() => {
    if (!projectRoot || !containerRef.current || activeAssistantRef.current === 'cosmos') return
    // ...unchanged body...
  }, [projectRoot])
```

(This second one reads `activeAssistantRef.current` inside the observer callback too, not just at effect-setup time — add the same check inside the `ResizeObserver` callback body, right after `const activeAssistant = activeAssistantRef.current`: `if (activeAssistant === 'cosmos') return`.)

- [ ] **Step 2: Render `CosmosChat` when `assistant === 'cosmos'`**

Add the import:

```typescript
import { CosmosChat } from './CosmosChat'
```

Change the return statement's terminal container to hide (not unmount — keeps claude/codex pty terminals alive underneath) when Cosmos is active, and render `CosmosChat` alongside it:

```typescript
  return (
    <div className="h-full flex flex-col bg-bg border-l border-border overflow-hidden">
      {projectRoot ? (
        <>
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden p-1"
            style={{ display: assistant === 'cosmos' ? 'none' : 'block' }}
          />
          {assistant === 'cosmos' && (
            <div className="flex-1 overflow-hidden">
              <CosmosChat cwd={projectRoot} />
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-xs text-fg-muted text-center leading-relaxed">
            Open a folder to start {assistant === 'claude' ? 'Claude Code' : assistant === 'codex' ? 'Codex' : 'Cosmos'}
          </p>
        </div>
      )}
    </div>
  )
```

- [ ] **Step 3: Typecheck and run the full test suite**

Run: `npx tsc -p tsconfig.web.json --noEmit && npx vitest run`
Expected: no type errors, all tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/Chat/Chat.tsx
git commit -m "feat: render CosmosChat instead of a pty terminal when Cosmos is the active assistant"
```

---

## Task 11: `App.tsx` + command palette — third assistant option, icon, session wiring

**Files:**
- Modify: `src/components/ActivityBar/ActivityBar.tsx` (add `CosmosIcon`)
- Modify: `src/App.tsx`
- Modify: `src/components/Search/commands.ts`

**Interfaces:**
- Consumes: `CosmosIcon` (new export from `ActivityBar.tsx`), `useCosmosStore.newSession/previousSession` (Task 8).

- [ ] **Step 1: Add `CosmosIcon` to `ActivityBar.tsx`**

Add near `ClaudeIcon`/`CodexIcon` (after `CodexIcon`, matching their `width`/`height`/viewBox conventions):

```typescript
export function CosmosIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="2" width="14.14" height="14.14" rx="2" transform="rotate(45 12 2)" fill="#D97757" />
    </svg>
  )
}
```

- [ ] **Step 2: Update `App.tsx` imports, options, and labels**

Add `CosmosIcon` to the import from `./components/ActivityBar/ActivityBar` and `useCosmosStore` import:

```typescript
import { useCosmosStore } from './stores/cosmosStore'
```

Update `ASSISTANT_OPTIONS`:

```typescript
const ASSISTANT_OPTIONS: Array<{ id: AssistantKind; label: string }> = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'cosmos', label: 'Cosmos' },
]
```

Update the icon lookups (line 226, 252, 357) from the binary `assistant === 'claude' ? <ClaudeIcon /> : <CodexIcon />` to a three-way helper. Add near the top of the component (or as a module-level function above `App`):

```typescript
function assistantIcon(kind: AssistantKind) {
  return kind === 'claude' ? <ClaudeIcon /> : kind === 'codex' ? <CodexIcon /> : <CosmosIcon />
}
```

Replace each of the three call sites:
- Line 226: `{assistant === 'claude' ? <ClaudeIcon /> : <CodexIcon />}` → `{assistantIcon(assistant)}`
- Line 252: `{option.id === 'claude' ? <ClaudeIcon /> : <CodexIcon />}` → `{assistantIcon(option.id)}`
- Line 357: `icon: assistant === 'claude' ? <ClaudeIcon /> : <CodexIcon />,` → `icon: assistantIcon(assistant),`

Update the label/title lines (94-96):

```typescript
  const assistantLabel = assistant === 'claude' ? 'Claude Code' : assistant === 'codex' ? 'Codex' : 'Cosmos'
  const newSessionTitle = assistant === 'claude' ? 'New Claude Session' : assistant === 'codex' ? 'New Codex Session' : 'New Cosmos Session'
  const previousSessionTitle = assistant === 'claude' ? 'Continue Claude Session' : assistant === 'codex' ? 'Resume Latest Codex Session' : 'Restore Previous Cosmos Session'
```

- [ ] **Step 3: Wire new/previous session buttons to `cosmosStore` when Cosmos is active**

The existing buttons (lines 364-378) call `useClaudeStore.getState().newSession(projectRoot)` / `.previousSession(projectRoot)` unconditionally. Change their `onClick` handlers:

```typescript
              {
                id: 'new-session',
                icon: <NewSessionIcon />,
                title: newSessionTitle,
                active: false,
                disabled: !projectRoot,
                onClick: () => {
                  if (!projectRoot) return
                  if (assistant === 'cosmos') useCosmosStore.getState().newSession()
                  else useClaudeStore.getState().newSession(projectRoot)
                },
              },
              {
                id: 'previous-session',
                icon: <PreviousSessionIcon />,
                title: previousSessionTitle,
                active: false,
                disabled: !projectRoot,
                onClick: () => {
                  if (!projectRoot) return
                  if (assistant === 'cosmos') useCosmosStore.getState().previousSession()
                  else useClaudeStore.getState().previousSession(projectRoot)
                },
              },
```

- [ ] **Step 4: Add a command palette entry to switch to Cosmos**

In `src/components/Search/commands.ts`, alongside the existing "Use Codex"/"Use Claude Code" entries, add:

```typescript
  {
    id: 'assistant-cosmos',
    label: 'Use Cosmos',
    description: 'Use Cosmos as the AI assistant',
    keywords: ['assistant', 'model', 'cosmos'],
    condition: () => useClaudeStore.getState().assistant !== 'cosmos',
    action: () => useClaudeStore.getState().setAssistant('cosmos'),
  },
```

(Match the exact shape/fields of the existing entries in that file — copy the object structure from the "Use Codex" entry rather than guessing field names, since this plan step doesn't have the full file in view.)

- [ ] **Step 5: Typecheck and run the full test suite**

Run: `npx tsc -p tsconfig.web.json --noEmit && npx vitest run`
Expected: no type errors, all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ActivityBar/ActivityBar.tsx src/App.tsx src/components/Search/commands.ts
git commit -m "feat: add Cosmos as a third assistant option in the switcher and command palette"
```

---

## Task 12: Shift+Tab Agent Mode toggle + shortcuts registry

**Files:**
- Create: `src/components/Chat/useCosmosAgentModeShortcut.ts`
- Modify: `src/components/Chat/CosmosChat.tsx` (use the hook)
- Modify: `src/components/Shortcuts/shortcuts.ts`
- Test: `src/components/Chat/__tests__/useCosmosAgentModeShortcut.test.ts`

**Interfaces:**
- Consumes: `useCosmosStore.toggleAgentMode` (Task 8).
- Produces: `useCosmosAgentModeShortcut(): void` — call it from `CosmosChat` so the binding is only live while the Cosmos panel is mounted.

- [ ] **Step 1: Write the failing test**

Create `src/components/Chat/__tests__/useCosmosAgentModeShortcut.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCosmosAgentModeShortcut } from '../useCosmosAgentModeShortcut'
import { useCosmosStore } from '@/stores/cosmosStore'

beforeEach(() => {
  useCosmosStore.setState({ agentMode: false })
})

describe('useCosmosAgentModeShortcut', () => {
  it('toggles agentMode on Shift+Tab', () => {
    renderHook(() => useCosmosAgentModeShortcut())

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
    window.dispatchEvent(event)

    expect(useCosmosStore.getState().agentMode).toBe(true)
  })

  it('prevents the default Tab focus-move behavior', () => {
    renderHook(() => useCosmosAgentModeShortcut())

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('does not toggle on plain Tab (no shift)', () => {
    renderHook(() => useCosmosAgentModeShortcut())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false }))

    expect(useCosmosStore.getState().agentMode).toBe(false)
  })

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useCosmosAgentModeShortcut())
    unmount()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))

    expect(useCosmosStore.getState().agentMode).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Chat/__tests__/useCosmosAgentModeShortcut.test.ts`
Expected: FAIL — hook does not exist.

- [ ] **Step 3: Implement the hook**

```typescript
import { useEffect } from 'react'
import { useCosmosStore } from '@/stores/cosmosStore'

export function useCosmosAgentModeShortcut(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !e.shiftKey) return
      e.preventDefault()
      useCosmosStore.getState().toggleAgentMode()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Chat/__tests__/useCosmosAgentModeShortcut.test.ts`
Expected: PASS

- [ ] **Step 5: Wire the hook into `CosmosChat.tsx`**

In `src/components/Chat/CosmosChat.tsx`, add the import and call it at the top of the component body:

```typescript
import { useCosmosAgentModeShortcut } from './useCosmosAgentModeShortcut'
```

```typescript
export function CosmosChat({ cwd }: { cwd: string }) {
  useCosmosAgentModeShortcut()
  // ...rest unchanged
```

- [ ] **Step 6: Add the shortcut to the registry**

In `src/components/Shortcuts/shortcuts.ts`, add a new entry to the `Navigation` group (or a new `Cosmos` category if that reads better — match whichever existing groups look most appropriate by category name):

```typescript
      { keys: ['⇧', '⇥'], label: 'Toggle Cosmos Agent Mode' },
```

- [ ] **Step 7: Update the existing `shortcuts.test.ts` count assertions if they assert a total count**

Read `src/components/Shortcuts/__tests__/shortcuts.test.ts` and `ShortcutsOverlay.test.tsx` — if either asserts a fixed total number of shortcut entries or a fixed count of `⌘`/`⇧` key caps (the `ShortcutsOverlay.test.tsx` example earlier in this plan asserts `getAllByText('⇧').length` with `.toBeGreaterThan(0)`, which won't break, but double check for any exact-count assertions) and update them to account for the new entry.

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/components/Chat/useCosmosAgentModeShortcut.ts src/components/Chat/CosmosChat.tsx src/components/Shortcuts/shortcuts.ts src/components/Chat/__tests__/useCosmosAgentModeShortcut.test.ts
git commit -m "feat: add Shift+Tab shortcut to toggle Cosmos Agent Mode"
```

---

## Task 13: Manual smoke test against the real Cosmos endpoint

Not a code task — validates the one open risk flagged in the design spec: that Cosmos's `/v1/chat/completions` actually streams `tool_calls` in the standard OpenAI shape this plan assumes.

- [ ] **Step 1: Start Huginn against the real endpoint**

Run: `npm run dev`

- [ ] **Step 2: Configure Cosmos settings**

Open Settings → Cosmos, enter the real Endpoint/API Key/Model ID from the VS Code connection panel, click Test Connection, confirm it shows "Connected".

- [ ] **Step 3: Exercise the full loop with approval gate on**

Open a project, switch the assistant switcher to Cosmos, send a message that requires a file read and a file write (e.g. "read package.json and add a one-line comment noting today's date at the top"). Confirm:
- Text streams in visibly (not all-at-once).
- A `read_file` tool-call block appears, then a `write_file` block with Approve/Reject.
- Approving executes the write and the file changes on disk.

- [ ] **Step 4: Exercise Agent Mode**

Press Shift+Tab, confirm the "Agent Mode" indicator appears, send a message requiring a tool call, confirm it executes without an approval prompt.

- [ ] **Step 5: Exercise run_command**

With Agent Mode on, ask Cosmos to run `ls` in the project. Confirm the tool-call block shows real output when expanded.

- [ ] **Step 6: Note any protocol mismatches**

If the tool-call streaming shape differs from what `parseSSEChunk`/`toolCallAccs` in `electron/cosmos.ts` expect (e.g. different field names, non-standard chunk framing), capture a raw response sample and adjust the parsing logic in `electron/cosmos.ts` accordingly — do not change the test fixtures in Task 2/3 to match broken behavior; fix the parser and confirm both the smoke test and the existing unit tests still pass.

- [ ] **Step 7: Final full-suite check and typecheck**

Run: `npx vitest run && npx tsc -p tsconfig.node.json --noEmit && npx tsc -p tsconfig.web.json --noEmit`
Expected: all PASS, no type errors.
