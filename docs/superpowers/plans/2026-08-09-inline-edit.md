# Inline Edit (Cmd+K) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cursor-style Cmd+K inline code editing to Huginn's Monaco editor — select code (or just place the cursor), describe a change, and get a streamed, previewable diff you can accept or reject, powered by the same `claude` subscription infrastructure as inline autocomplete.

**Architecture:** A new `InlineEditManager` in the Electron main process spawns `claude -p --output-format stream-json` child processes (reusing `resolveClaudePath` from the existing `electron/autocomplete.ts`), parsing newline-delimited JSON and forwarding text deltas to the renderer as event-based IPC (matching Cosmos's streaming pattern, not autocomplete's promise-based one). The renderer holds a single global state-machine store with per-editor ownership tracking (so split panes never render each other's sessions), and a per-editor-instance Monaco integration module drives a content-widget prompt, decorations, and a view zone to show the inline diff.

**Tech Stack:** Electron (`child_process`), Monaco (content widgets, view zones, decorations via `@monaco-editor/react`'s `onMount`), zustand, vitest + `@testing-library/react`.

## Global Constraints

- Never pass `--bare` to the `claude` CLI, and never shell-interpolate the prompt — array-form `spawn` only, same as `electron/autocomplete.ts`.
- `--verbose` is **required** alongside `--output-format stream-json` in `--print` mode — confirmed directly against the installed CLI (`Error: When using --print, --output-format=stream-json requires --verbose` when omitted).
- Stream parsing: one JSON object per line (NDJSON). Only `{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":...}}}` lines carry insertable text — `thinking_delta` and `signature_delta` deltas (from the model's extended-thinking content block, which always precedes the real text block) must be ignored, not concatenated.
- Errors are shown to the user inline (not silent like autocomplete) — this is an explicit, waited-on action, not a background suggestion.
- Only one inline-edit session may be active per Electron window at a time (per-window supersede at the manager level, identical to `AutocompleteManager`) **and** per renderer: the renderer-side store tracks which editor instance owns the active session, so a second split pane never renders or reacts to another pane's session.
- Default model: `claude-sonnet-5`. Same four selectable models as autocomplete (reuse `AUTOCOMPLETE_MODELS` from `src/stores/autocompleteSettingsStore.ts` — do not duplicate the list).
- Per-request timeout: 30000ms (longer than autocomplete's 15s — this is a deliberate, already-streaming action the user is actively watching, not a background suggestion racing the next keystroke).
- Cmd+K is registered only on the writable `MonacoEditor` instance (not `DiffEditor`), matching how `registerAutocompleteProvider` is scoped in `Editor.tsx`.
- The editor is set read-only (`editor.updateOptions({ readOnly: true })`) while a session is generating/reviewing/erroring, restored to editable the moment it returns to idle — this prevents the target range from going stale if the user types elsewhere mid-session.

---

### Task 1: Inline edit settings store

**Files:**
- Create: `src/stores/inlineEditSettingsStore.ts`
- Test: `src/stores/__tests__/inlineEditSettingsStore.test.ts`

**Interfaces:**
- Consumes: nothing new (localStorage only).
- Produces: `useInlineEditSettingsStore` with state `{ enabled: boolean, model: string }` and actions `setEnabled(value: boolean)`, `setModel(value: string)`. Default `enabled: true`, default `model: 'claude-sonnet-5'`.
- Consumed by: Task 8 (Monaco wiring reads `model`), Task 9 (settings page).

- [ ] **Step 1: Write the failing test**

```ts
// src/stores/__tests__/inlineEditSettingsStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  return { store }
})

import { useInlineEditSettingsStore } from '../inlineEditSettingsStore'

describe('inlineEditSettingsStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    useInlineEditSettingsStore.setState({ enabled: true, model: 'claude-sonnet-5' })
  })

  it('defaults to enabled with Sonnet 5 as the model', () => {
    expect(useInlineEditSettingsStore.getState().enabled).toBe(true)
    expect(useInlineEditSettingsStore.getState().model).toBe('claude-sonnet-5')
  })

  it('setEnabled persists to localStorage', () => {
    useInlineEditSettingsStore.getState().setEnabled(false)
    expect(useInlineEditSettingsStore.getState().enabled).toBe(false)
    expect(store['huginn:inlineEdit:enabled']).toBe('false')
  })

  it('setModel persists to localStorage', () => {
    useInlineEditSettingsStore.getState().setModel('claude-opus-5')
    expect(useInlineEditSettingsStore.getState().model).toBe('claude-opus-5')
    expect(store['huginn:inlineEdit:model']).toBe('claude-opus-5')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/stores/__tests__/inlineEditSettingsStore.test.ts`
Expected: FAIL — cannot find module `../inlineEditSettingsStore`

- [ ] **Step 3: Implement**

```ts
// src/stores/inlineEditSettingsStore.ts
import { create } from 'zustand'

const KEYS = {
  enabled: 'huginn:inlineEdit:enabled',
  model: 'huginn:inlineEdit:model',
}

const DEFAULT_MODEL = 'claude-sonnet-5'

function getBool(key: string, def: boolean): boolean {
  try {
    const value = localStorage.getItem(key)
    return value === null ? def : value === 'true'
  } catch {
    return def
  }
}

function getString(key: string, def: string): string {
  try {
    return localStorage.getItem(key) ?? def
  } catch {
    return def
  }
}

interface InlineEditSettingsStore {
  enabled: boolean
  model: string
  setEnabled: (value: boolean) => void
  setModel: (value: string) => void
}

export const useInlineEditSettingsStore = create<InlineEditSettingsStore>((set) => ({
  enabled: getBool(KEYS.enabled, true),
  model: getString(KEYS.model, DEFAULT_MODEL),

  setEnabled: (value) => {
    try { localStorage.setItem(KEYS.enabled, String(value)) } catch {}
    set({ enabled: value })
  },
  setModel: (value) => {
    try { localStorage.setItem(KEYS.model, value) } catch {}
    set({ model: value })
  },
}))
```

- [ ] **Step 4: Run the test again to verify it passes**

Run: `npx vitest run src/stores/__tests__/inlineEditSettingsStore.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stores/inlineEditSettingsStore.ts src/stores/__tests__/inlineEditSettingsStore.test.ts
git commit -m "Add inline edit settings store (enabled, model, default Sonnet 5)"
```

---

### Task 2: Prompt building and stream-json line parsing (pure functions)

**Files:**
- Create: `electron/inlineEdit.ts` (this task writes only the pure-function portion; Task 3 extends the same file)
- Test: `electron/__tests__/inlineEdit.test.ts` (this task writes only the pure-function tests; Task 3 extends the same file)

**Interfaces:**
- Produces: `buildEditSystemPrompt(): string`, `buildEditPrompt(prefix: string, suffix: string, selection: string, instruction: string, language: string): string`, `parseStreamJsonLine(line: string): { type: 'delta'; text: string } | { type: 'result'; isError: boolean } | null`.
- Consumed by: Task 3's `InlineEditManager`.

- [ ] **Step 1: Write the failing tests**

```ts
// electron/__tests__/inlineEdit.test.ts
import { describe, it, expect } from 'vitest'
import { buildEditSystemPrompt, buildEditPrompt, parseStreamJsonLine } from '../inlineEdit'

describe('buildEditSystemPrompt', () => {
  it('instructs the model to respond with only the replacement code', () => {
    const prompt = buildEditSystemPrompt()
    expect(prompt).toContain('ONLY')
    expect(prompt).toContain('no markdown code fences')
  })
})

describe('buildEditPrompt', () => {
  it('wraps prefix, selection, suffix, language, and the instruction', () => {
    const prompt = buildEditPrompt('const x = 1\n', 'const y = 2\n', 'foo()', 'add a comment', 'typescript')
    expect(prompt).toBe(
      'Language: typescript\n<prefix>\nconst x = 1\n\n</prefix>\n<selection>\nfoo()\n</selection>\n<suffix>\nconst y = 2\n\n</suffix>\n\nInstruction: add a comment'
    )
  })

  it('handles an empty selection (insert mode)', () => {
    const prompt = buildEditPrompt('const x = 1\n', '', '', 'add a log line', 'typescript')
    expect(prompt).toBe(
      'Language: typescript\n<prefix>\nconst x = 1\n\n</prefix>\n<selection>\n\n</selection>\n<suffix>\n\n</suffix>\n\nInstruction: add a log line'
    )
  })
})

describe('parseStreamJsonLine', () => {
  it('extracts a text delta from a content_block_delta event', () => {
    const line = '{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"hello world"}},"session_id":"abc"}'
    expect(parseStreamJsonLine(line)).toEqual({ type: 'delta', text: 'hello world' })
  })

  it('ignores a thinking_delta event', () => {
    const line = '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"reasoning..."}},"session_id":"abc"}'
    expect(parseStreamJsonLine(line)).toBeNull()
  })

  it('ignores a signature_delta event', () => {
    const line = '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"abc123"}},"session_id":"abc"}'
    expect(parseStreamJsonLine(line)).toBeNull()
  })

  it('reports a successful result line', () => {
    const line = '{"is_error":false,"result":"hello world","type":"result","subtype":"success"}'
    expect(parseStreamJsonLine(line)).toEqual({ type: 'result', isError: false })
  })

  it('reports a failed result line', () => {
    const line = '{"is_error":true,"result":"","type":"result","subtype":"error"}'
    expect(parseStreamJsonLine(line)).toEqual({ type: 'result', isError: true })
  })

  it('ignores an unrelated system event', () => {
    const line = '{"type":"system","subtype":"init","session_id":"abc"}'
    expect(parseStreamJsonLine(line)).toBeNull()
  })

  it('ignores a content_block_start event', () => {
    const line = '{"type":"stream_event","event":{"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}}'
    expect(parseStreamJsonLine(line)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseStreamJsonLine('not json')).toBeNull()
  })

  it('returns null for an empty line', () => {
    expect(parseStreamJsonLine('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run electron/__tests__/inlineEdit.test.ts`
Expected: FAIL — cannot find module `../inlineEdit`

- [ ] **Step 3: Implement the pure functions**

```ts
// electron/inlineEdit.ts
const SYSTEM_PROMPT = `You are a code-editing assistant embedded in a code editor. You will be given the code immediately before the target region (<prefix>), the code currently selected within that region (<selection>, which may be empty), the code immediately after it (<suffix>), and an instruction describing the change to make. Respond with ONLY the replacement code — if <selection> is non-empty, respond with the code that should replace it; if <selection> is empty, respond with the code that should be inserted at the cursor. No explanations, no markdown code fences, no repeating unrelated surrounding code.`

export function buildEditSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildEditPrompt(
  prefix: string,
  suffix: string,
  selection: string,
  instruction: string,
  language: string
): string {
  return `Language: ${language}\n<prefix>\n${prefix}\n</prefix>\n<selection>\n${selection}\n</selection>\n<suffix>\n${suffix}\n</suffix>\n\nInstruction: ${instruction}`
}

export type StreamLineEvent =
  | { type: 'delta'; text: string }
  | { type: 'result'; isError: boolean }

export function parseStreamJsonLine(line: string): StreamLineEvent | null {
  let obj: unknown
  try {
    obj = JSON.parse(line)
  } catch {
    return null
  }

  if (!obj || typeof obj !== 'object') return null
  const record = obj as Record<string, unknown>

  if (record.type === 'stream_event') {
    const event = record.event as Record<string, unknown> | undefined
    const delta = event?.delta as Record<string, unknown> | undefined
    if (event?.type === 'content_block_delta' && delta?.type === 'text_delta' && typeof delta.text === 'string') {
      return { type: 'delta', text: delta.text }
    }
    return null
  }

  if (record.type === 'result') {
    return { type: 'result', isError: record.is_error === true }
  }

  return null
}
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx vitest run electron/__tests__/inlineEdit.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add electron/inlineEdit.ts electron/__tests__/inlineEdit.test.ts
git commit -m "Add inline edit prompt-building and stream-json line parsing"
```

---

### Task 3: InlineEditManager (spawns streaming `claude -p`, per-window supersede, cancellation, timeout)

**Files:**
- Modify: `electron/inlineEdit.ts` (append to the file created in Task 2)
- Modify: `electron/__tests__/inlineEdit.test.ts` (append to the file created in Task 2)

**Interfaces:**
- Consumes: `buildEditSystemPrompt`, `buildEditPrompt`, `parseStreamJsonLine` (Task 2, same file); `resolveClaudePath`, `_resetClaudePathCacheForTesting` from `./autocomplete` (already implemented, do not modify).
- Produces: `InlineEditStartPayload` interface, `InlineEditEvent` union type, `class InlineEditManager { registerHandlers(): void; disposeWindow(windowId: number): void }`.
- Consumed by: Task 4 (`main.ts` wiring), Task 5 (preload/api.d.ts import the two types).

- [ ] **Step 1: Write the failing tests (append to the existing test file)**

Add these imports to the top of `electron/__tests__/inlineEdit.test.ts`, replacing the existing `import { describe, it, expect } from 'vitest'` line and existing plain import:

```ts
// electron/__tests__/inlineEdit.test.ts (new top of file)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

const { handlers, spawnMock, execFileMock } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => unknown>,
  spawnMock: vi.fn(),
  execFileMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, fn: (...args: any[]) => unknown) => { handlers[channel] = fn },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
  },
}))

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
  execFile: (...args: unknown[]) => execFileMock(...args),
}))

import { buildEditSystemPrompt, buildEditPrompt, parseStreamJsonLine, InlineEditManager } from '../inlineEdit'
import { _resetClaudePathCacheForTesting } from '../autocomplete'
```

(Keep every existing `describe('buildEditSystemPrompt', ...)`, `describe('buildEditPrompt', ...)`, and `describe('parseStreamJsonLine', ...)` block from Task 2 exactly as-is, below these new imports.)

Then append the new test suites at the end of the file:

```ts
function fakeProc() {
  const proc: any = new EventEmitter()
  proc.stdout = new EventEmitter()
  proc.kill = vi.fn(() => proc.emit('close', null))
  return proc
}

function fakeWin(id: number) {
  return { id, isDestroyed: () => false, webContents: { send: vi.fn() } }
}

// A macrotask tick reliably drains however many microtask hops sit between
// calling the fire-and-forget handler and it reaching the synchronous
// spawn() call (the exact count depends on the await inside
// resolveClaudePath()), without the test needing to know that number.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const BASE_PAYLOAD = {
  requestId: 'req-1',
  prefix: 'const x = 1\n',
  suffix: '',
  selection: 'foo()',
  instruction: 'add a comment',
  language: 'typescript',
  model: 'claude-sonnet-5',
}

describe('InlineEditManager', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    execFileMock.mockReset()
    execFileMock.mockImplementation((_shell, _args, cb) => cb(null, '/usr/local/bin/claude', ''))
    _resetClaudePathCacheForTesting()
  })

  function setup() {
    const manager = new InlineEditManager()
    manager.registerHandlers()
    return { manager, startHandler: handlers['inlineEdit:start'], cancelHandler: handlers['inlineEdit:cancel'] }
  }

  it('spawns claude with streaming flags, no shell, and no --bare', async () => {
    const { startHandler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)
    const win = fakeWin(1)

    startHandler({ sender: win }, BASE_PAYLOAD)
    await flushMicrotasks()

    const [command, args, options] = spawnMock.mock.calls[0]
    expect(command).toBe('/usr/local/bin/claude')
    expect(args).toContain('-p')
    expect(args[args.indexOf('--output-format') + 1]).toBe('stream-json')
    expect(args).toContain('--include-partial-messages')
    expect(args).toContain('--verbose')
    expect(args).not.toContain('--bare')
    expect(options.shell).toBeFalsy()
  })

  it('forwards text deltas as they stream in, tagged with the request id', async () => {
    const { startHandler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)
    const win = fakeWin(1)

    startHandler({ sender: win }, BASE_PAYLOAD)
    await flushMicrotasks()

    proc.stdout.emit('data', Buffer.from('{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"hello"}}}\n'))

    expect(win.webContents.send).toHaveBeenCalledWith('inlineEdit:event', { type: 'delta', requestId: 'req-1', text: 'hello' })
  })

  it('buffers a line split across multiple stdout chunks', async () => {
    const { startHandler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)
    const win = fakeWin(1)

    startHandler({ sender: win }, BASE_PAYLOAD)
    await flushMicrotasks()

    const line = '{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"split"}}}\n'
    proc.stdout.emit('data', Buffer.from(line.slice(0, 20)))
    proc.stdout.emit('data', Buffer.from(line.slice(20)))

    expect(win.webContents.send).toHaveBeenCalledWith('inlineEdit:event', { type: 'delta', requestId: 'req-1', text: 'split' })
  })

  it('sends done when the process closes cleanly with no error result', async () => {
    const { startHandler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)
    const win = fakeWin(1)

    startHandler({ sender: win }, BASE_PAYLOAD)
    await flushMicrotasks()
    proc.emit('close', 0)

    expect(win.webContents.send).toHaveBeenCalledWith('inlineEdit:event', { type: 'done', requestId: 'req-1' })
  })

  it('sends an error when the process exits non-zero', async () => {
    const { startHandler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)
    const win = fakeWin(1)

    startHandler({ sender: win }, BASE_PAYLOAD)
    await flushMicrotasks()
    proc.emit('close', 1)

    expect(win.webContents.send).toHaveBeenCalledWith('inlineEdit:event', { type: 'error', requestId: 'req-1', message: 'Something went wrong' })
  })

  it('sends an error when a result line reports is_error even on a zero exit code', async () => {
    const { startHandler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)
    const win = fakeWin(1)

    startHandler({ sender: win }, BASE_PAYLOAD)
    await flushMicrotasks()
    proc.stdout.emit('data', Buffer.from('{"type":"result","is_error":true,"result":""}\n'))
    proc.emit('close', 0)

    expect(win.webContents.send).toHaveBeenCalledWith('inlineEdit:event', { type: 'error', requestId: 'req-1', message: 'Something went wrong' })
  })

  it('sends an error when the process itself errors', async () => {
    const { startHandler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)
    const win = fakeWin(1)

    startHandler({ sender: win }, BASE_PAYLOAD)
    await flushMicrotasks()
    proc.emit('error', new Error('spawn failed'))

    expect(win.webContents.send).toHaveBeenCalledWith('inlineEdit:event', { type: 'error', requestId: 'req-1', message: 'Failed to start claude' })
  })

  it('sends a single error and does not spawn when claude cannot be resolved', async () => {
    execFileMock.mockImplementation((_shell, _args, cb) => cb(new Error('not found'), '', ''))
    const { startHandler } = setup()
    const win = fakeWin(1)

    startHandler({ sender: win }, BASE_PAYLOAD)
    await flushMicrotasks()

    expect(spawnMock).not.toHaveBeenCalled()
    expect(win.webContents.send).toHaveBeenCalledWith('inlineEdit:event', { type: 'error', requestId: 'req-1', message: 'claude CLI not found' })
  })

  it('kills the previous in-flight request for the same window and sends no events for it once a new one arrives', async () => {
    const { startHandler } = setup()
    const procA = fakeProc()
    const procB = fakeProc()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)
    const win = fakeWin(1)

    startHandler({ sender: win }, { ...BASE_PAYLOAD, requestId: 'req-a' })
    await flushMicrotasks()
    startHandler({ sender: win }, { ...BASE_PAYLOAD, requestId: 'req-b' })
    await flushMicrotasks()

    expect(procA.kill).toHaveBeenCalled()
    win.webContents.send.mockClear()
    procA.emit('close', 0)
    expect(win.webContents.send).not.toHaveBeenCalled()

    procB.emit('close', 0)
    expect(win.webContents.send).toHaveBeenCalledWith('inlineEdit:event', { type: 'done', requestId: 'req-b' })
  })

  it('does not affect an in-flight request in a different window', async () => {
    const { startHandler } = setup()
    const procA = fakeProc()
    const procB = fakeProc()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)
    const winA = fakeWin(1)
    const winB = fakeWin(2)

    startHandler({ sender: winA }, { ...BASE_PAYLOAD, requestId: 'req-a' })
    await flushMicrotasks()
    startHandler({ sender: winB }, { ...BASE_PAYLOAD, requestId: 'req-b' })
    await flushMicrotasks()

    expect(procA.kill).not.toHaveBeenCalled()
    procA.emit('close', 0)
    procB.emit('close', 0)
  })

  it('sends no events after an explicit cancel', async () => {
    const { startHandler, cancelHandler } = setup()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)
    const win = fakeWin(1)

    startHandler({ sender: win }, BASE_PAYLOAD)
    await flushMicrotasks()
    cancelHandler({ sender: win })

    win.webContents.send.mockClear()
    proc.stdout.emit('data', Buffer.from('{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"late"}}}\n'))
    proc.emit('close', 0)

    expect(win.webContents.send).not.toHaveBeenCalled()
  })
})

describe('InlineEditManager timeout handling', () => {
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

  it('kills the process and sends an error after the timeout with no response', async () => {
    const manager = new InlineEditManager()
    manager.registerHandlers()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)
    const win = fakeWin(1)

    handlers['inlineEdit:start']({ sender: win }, BASE_PAYLOAD)
    await vi.advanceTimersByTimeAsync(0)
    expect(proc.kill).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30000)

    expect(proc.kill).toHaveBeenCalled()
    expect(win.webContents.send).toHaveBeenCalledWith('inlineEdit:event', { type: 'error', requestId: 'req-1', message: 'Timed out' })
  })

  it('does not fire the timeout when the process closes before 30s', async () => {
    const manager = new InlineEditManager()
    manager.registerHandlers()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)
    const win = fakeWin(1)

    handlers['inlineEdit:start']({ sender: win }, BASE_PAYLOAD)
    await vi.advanceTimersByTimeAsync(0)
    proc.emit('close', 0)

    win.webContents.send.mockClear()
    await vi.advanceTimersByTimeAsync(30000)

    expect(proc.kill).not.toHaveBeenCalled()
    expect(win.webContents.send).not.toHaveBeenCalled()
  })
})

describe('InlineEditManager disposeWindow', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    execFileMock.mockReset()
    execFileMock.mockImplementation((_shell, _args, cb) => cb(null, '/usr/local/bin/claude', ''))
    _resetClaudePathCacheForTesting()
  })

  it('kills the in-flight process for that window and sends no further events', async () => {
    const manager = new InlineEditManager()
    manager.registerHandlers()
    const proc = fakeProc()
    spawnMock.mockReturnValueOnce(proc)
    const win = fakeWin(1)

    handlers['inlineEdit:start']({ sender: win }, BASE_PAYLOAD)
    await flushMicrotasks()
    manager.disposeWindow(1)

    expect(proc.kill).toHaveBeenCalled()
    win.webContents.send.mockClear()
    proc.emit('close', 0)
    expect(win.webContents.send).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to verify the new tests fail**

Run: `npx vitest run electron/__tests__/inlineEdit.test.ts`
Expected: FAIL — `InlineEditManager` is not exported yet.

- [ ] **Step 3: Append the manager implementation**

Add to the bottom of `electron/inlineEdit.ts` (keep the Task 2 content above it unchanged):

```ts
import { BrowserWindow, ipcMain } from 'electron'
import { spawn, type ChildProcessByStdio } from 'child_process'
import type { Readable } from 'stream'
import { resolveClaudePath } from './autocomplete'

const TIMEOUT_MS = 30000

export interface InlineEditStartPayload {
  requestId: string
  prefix: string
  suffix: string
  selection: string
  instruction: string
  language: string
  model: string
}

export type InlineEditEvent =
  | { type: 'delta'; requestId: string; text: string }
  | { type: 'done'; requestId: string }
  | { type: 'error'; requestId: string; message: string }

interface WindowState {
  proc: ChildProcessByStdio<null, Readable, Readable>
  suppressReporting: () => void
}

export class InlineEditManager {
  private currentByWindow = new Map<number, WindowState>()

  registerHandlers(): void {
    resolveClaudePath()

    ipcMain.on('inlineEdit:start', (event, payload: InlineEditStartPayload) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      this.start(win, payload)
    })

    ipcMain.on('inlineEdit:cancel', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      this.cancelWindow(win.id)
    })
  }

  disposeWindow(windowId: number): void {
    this.cancelWindow(windowId)
  }

  private cancelWindow(windowId: number): void {
    const state = this.currentByWindow.get(windowId)
    if (!state) return
    state.suppressReporting()
    state.proc.kill()
    this.currentByWindow.delete(windowId)
  }

  private async start(win: BrowserWindow, payload: InlineEditStartPayload): Promise<void> {
    this.cancelWindow(win.id)

    const claudePath = await resolveClaudePath()
    if (!claudePath) {
      if (!win.isDestroyed()) {
        win.webContents.send('inlineEdit:event', { type: 'error', requestId: payload.requestId, message: 'claude CLI not found' } satisfies InlineEditEvent)
      }
      return
    }

    try {
      const proc = spawn(
        claudePath,
        [
          '-p', buildEditPrompt(payload.prefix, payload.suffix, payload.selection, payload.instruction, payload.language),
          '--model', payload.model,
          '--output-format', 'stream-json',
          '--include-partial-messages',
          '--verbose',
          '--no-session-persistence',
          '--tools', '',
          '--setting-sources', '',
          '--system-prompt', buildEditSystemPrompt(),
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      )

      let reported = false

      const removeIfCurrent = () => {
        if (this.currentByWindow.get(win.id)?.proc === proc) this.currentByWindow.delete(win.id)
      }

      const reportDelta = (text: string) => {
        if (reported) return
        if (!win.isDestroyed()) win.webContents.send('inlineEdit:event', { type: 'delta', requestId: payload.requestId, text } satisfies InlineEditEvent)
      }
      const reportDone = () => {
        if (reported) return
        reported = true
        clearTimeout(timer)
        removeIfCurrent()
        if (!win.isDestroyed()) win.webContents.send('inlineEdit:event', { type: 'done', requestId: payload.requestId } satisfies InlineEditEvent)
      }
      const reportError = (message: string) => {
        if (reported) return
        reported = true
        clearTimeout(timer)
        removeIfCurrent()
        if (!win.isDestroyed()) win.webContents.send('inlineEdit:event', { type: 'error', requestId: payload.requestId, message } satisfies InlineEditEvent)
      }
      const suppressReporting = () => {
        reported = true
        clearTimeout(timer)
        removeIfCurrent()
      }

      this.currentByWindow.set(win.id, { proc, suppressReporting })

      const timer = setTimeout(() => {
        proc.kill()
        reportError('Timed out')
      }, TIMEOUT_MS)

      let buffer = ''
      let sawError = false

      proc.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const parsed = parseStreamJsonLine(line)
          if (parsed?.type === 'delta') {
            reportDelta(parsed.text)
          } else if (parsed?.type === 'result' && parsed.isError) {
            sawError = true
          }
        }
      })

      proc.on('error', () => reportError('Failed to start claude'))
      proc.on('close', (code) => {
        if (code !== 0 || sawError) reportError('Something went wrong')
        else reportDone()
      })
    } catch {
      if (!win.isDestroyed()) {
        win.webContents.send('inlineEdit:event', { type: 'error', requestId: payload.requestId, message: 'Failed to start claude' } satisfies InlineEditEvent)
      }
    }
  }
}
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx vitest run electron/__tests__/inlineEdit.test.ts`
Expected: PASS (all tests: 11 from Task 2 + 12 manager/timeout/dispose tests)

- [ ] **Step 5: Commit**

```bash
git add electron/inlineEdit.ts electron/__tests__/inlineEdit.test.ts
git commit -m "Add InlineEditManager: streams claude -p stream-json, per-window supersede, timeout"
```

---

### Task 4: Wire InlineEditManager into main.ts

**Files:**
- Modify: `electron/main.ts`

**Interfaces:**
- Consumes: `InlineEditManager` from Task 3 (`./inlineEdit`).

- [ ] **Step 1: Import the manager**

Find:
```ts
import { AutocompleteManager } from './autocomplete'
```

Replace with:
```ts
import { AutocompleteManager } from './autocomplete'
import { InlineEditManager } from './inlineEdit'
```

- [ ] **Step 2: Declare the module-level manager variable**

Find:
```ts
let autocompleteMgr: AutocompleteManager
```

Replace with:
```ts
let autocompleteMgr: AutocompleteManager
let inlineEditMgr: InlineEditManager
```

- [ ] **Step 3: Construct and register it in `whenReady()`**

Find:
```ts
  autocompleteMgr = new AutocompleteManager()
  autocompleteMgr.registerHandlers()

  buildMenu()
```

Replace with:
```ts
  autocompleteMgr = new AutocompleteManager()
  autocompleteMgr.registerHandlers()
  inlineEditMgr = new InlineEditManager()
  inlineEditMgr.registerHandlers()

  buildMenu()
```

- [ ] **Step 4: Dispose it on window close**

Find:
```ts
    autocompleteMgr.disposeWindow(win.id)
    buildMenu()
  })
```

Replace with:
```ts
    autocompleteMgr.disposeWindow(win.id)
    inlineEditMgr.disposeWindow(win.id)
    buildMenu()
  })
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.node.json`
Expected: no new errors (the pre-existing baseline errors in `cosmos.ts`/`git.ts` are unrelated and unaffected).

- [ ] **Step 6: Commit**

```bash
git add electron/main.ts
git commit -m "Wire InlineEditManager into the Electron main process"
```

---

### Task 5: IPC bridge — preload.ts and api.d.ts

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/types/api.d.ts`

**Interfaces:**
- Produces: `window.api.inlineEditStart(payload: InlineEditStartPayload): void`, `window.api.inlineEditCancel(): void`, `window.api.onInlineEditEvent(cb: (event: InlineEditEvent) => void): () => void`.
- Consumed by: Task 7 (`inlineEditClient.ts`).

- [ ] **Step 1: Add the bridge methods in preload.ts**

Find:
```ts
  autocompleteComplete: (prefix: string, suffix: string, language: string, model: string) =>
    ipcRenderer.invoke('autocomplete:complete', prefix, suffix, language, model),
})
```

Replace with:
```ts
  autocompleteComplete: (prefix: string, suffix: string, language: string, model: string) =>
    ipcRenderer.invoke('autocomplete:complete', prefix, suffix, language, model),

  inlineEditStart: (payload: import('./inlineEdit').InlineEditStartPayload) =>
    ipcRenderer.send('inlineEdit:start', payload),
  inlineEditCancel: () => ipcRenderer.send('inlineEdit:cancel'),
  onInlineEditEvent: (cb: (event: import('./inlineEdit').InlineEditEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: import('./inlineEdit').InlineEditEvent) => cb(event)
    ipcRenderer.on('inlineEdit:event', handler)
    return () => ipcRenderer.removeListener('inlineEdit:event', handler)
  },
})
```

- [ ] **Step 2: Add the type declarations in api.d.ts**

Find:
```ts
import type { BrowserViewEvent } from '../../electron/browserViews'
```

Replace with:
```ts
import type { BrowserViewEvent } from '../../electron/browserViews'
import type { InlineEditStartPayload, InlineEditEvent } from '../../electron/inlineEdit'
```

Find:
```ts
      autocompleteComplete: (prefix: string, suffix: string, language: string, model: string) => Promise<string | null>
    }
  }
}
```

Replace with:
```ts
      autocompleteComplete: (prefix: string, suffix: string, language: string, model: string) => Promise<string | null>

      inlineEditStart: (payload: InlineEditStartPayload) => void
      inlineEditCancel: () => void
      onInlineEditEvent: (cb: (event: InlineEditEvent) => void) => () => void
    }
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add electron/preload.ts src/types/api.d.ts
git commit -m "Expose inline edit start/cancel/event bridge over IPC"
```

---

### Task 6: Renderer state-machine store (with per-editor ownership)

**Files:**
- Create: `src/stores/inlineEditStore.ts`
- Test: `src/stores/__tests__/inlineEditStore.test.ts`

**Interfaces:**
- Produces: `InlineEditStatus = 'idle' | 'prompting' | 'generating' | 'reviewing' | 'error'`, `InlineEditTarget` interface (`startLineNumber`, `startColumn`, `endLineNumber`, `endColumn`), `useInlineEditStore` with state `{ status, owner: unknown, requestId: string | null, target: InlineEditTarget | null, accumulatedText: string, errorMessage: string | null }` and actions `openPrompt(owner, target)`, `closePrompt()`, `startGenerating(requestId)`, `appendDelta(requestId, text)`, `finishGenerating(requestId)`, `fail(requestId, message)`, `reset()`.
- Consumed by: Task 7 (`inlineEditClient.ts` calls `startGenerating`/`appendDelta`/`finishGenerating`/`fail`), Task 8 (Monaco wiring calls `openPrompt`/`closePrompt`/`reset` and subscribes to state, using `owner` to filter out other editors' sessions).

`owner` exists specifically so that when the app has multiple Monaco panes open (split view), only the editor instance that opened a session renders it — every other pane's subscription sees `owner !== itself` and tears down/ignores. Task 8 passes the editor instance itself as `owner`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/stores/__tests__/inlineEditStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useInlineEditStore, type InlineEditTarget } from '../inlineEditStore'

const TARGET: InlineEditTarget = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 }
const OWNER_A = { name: 'editor-a' }
const OWNER_B = { name: 'editor-b' }

describe('inlineEditStore', () => {
  beforeEach(() => {
    useInlineEditStore.setState({
      status: 'idle', owner: null, requestId: null, target: null, accumulatedText: '', errorMessage: null,
    })
  })

  it('defaults to idle with no owner or target', () => {
    const s = useInlineEditStore.getState()
    expect(s.status).toBe('idle')
    expect(s.owner).toBeNull()
    expect(s.target).toBeNull()
  })

  it('openPrompt sets prompting, owner, and target, clearing any prior request state', () => {
    useInlineEditStore.setState({ requestId: 'stale', accumulatedText: 'stale text', errorMessage: 'stale error' })
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)

    const s = useInlineEditStore.getState()
    expect(s.status).toBe('prompting')
    expect(s.owner).toBe(OWNER_A)
    expect(s.target).toEqual(TARGET)
    expect(s.requestId).toBeNull()
    expect(s.accumulatedText).toBe('')
    expect(s.errorMessage).toBeNull()
  })

  it('closePrompt resets to idle and clears owner and target', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().closePrompt()

    const s = useInlineEditStore.getState()
    expect(s.status).toBe('idle')
    expect(s.owner).toBeNull()
    expect(s.target).toBeNull()
  })

  it('startGenerating sets generating and the request id, preserving owner and target', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')

    const s = useInlineEditStore.getState()
    expect(s.status).toBe('generating')
    expect(s.requestId).toBe('req-1')
    expect(s.owner).toBe(OWNER_A)
    expect(s.target).toEqual(TARGET)
  })

  it('appendDelta accumulates text for the matching request id', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')
    useInlineEditStore.getState().appendDelta('req-1', 'foo')
    useInlineEditStore.getState().appendDelta('req-1', 'bar')

    expect(useInlineEditStore.getState().accumulatedText).toBe('foobar')
  })

  it('appendDelta ignores a stale request id', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')
    useInlineEditStore.getState().appendDelta('req-0', 'stale')

    expect(useInlineEditStore.getState().accumulatedText).toBe('')
  })

  it('finishGenerating transitions to reviewing only for the matching request id', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')
    useInlineEditStore.getState().finishGenerating('req-0')
    expect(useInlineEditStore.getState().status).toBe('generating')

    useInlineEditStore.getState().finishGenerating('req-1')
    expect(useInlineEditStore.getState().status).toBe('reviewing')
  })

  it('fail transitions to error with the message only for the matching request id', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')
    useInlineEditStore.getState().fail('req-0', 'stale error')
    expect(useInlineEditStore.getState().status).toBe('generating')

    useInlineEditStore.getState().fail('req-1', 'Something went wrong')
    expect(useInlineEditStore.getState().status).toBe('error')
    expect(useInlineEditStore.getState().errorMessage).toBe('Something went wrong')
  })

  it('reset clears everything back to idle', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')
    useInlineEditStore.getState().appendDelta('req-1', 'text')
    useInlineEditStore.getState().reset()

    const s = useInlineEditStore.getState()
    expect(s.status).toBe('idle')
    expect(s.owner).toBeNull()
    expect(s.requestId).toBeNull()
    expect(s.target).toBeNull()
    expect(s.accumulatedText).toBe('')
    expect(s.errorMessage).toBeNull()
  })

  it('a second openPrompt from a different owner overwrites the owner (supersede)', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().openPrompt(OWNER_B, TARGET)

    expect(useInlineEditStore.getState().owner).toBe(OWNER_B)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/stores/__tests__/inlineEditStore.test.ts`
Expected: FAIL — cannot find module `../inlineEditStore`

- [ ] **Step 3: Implement**

```ts
// src/stores/inlineEditStore.ts
import { create } from 'zustand'

export type InlineEditStatus = 'idle' | 'prompting' | 'generating' | 'reviewing' | 'error'

export interface InlineEditTarget {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

interface InlineEditStore {
  status: InlineEditStatus
  owner: unknown
  requestId: string | null
  target: InlineEditTarget | null
  accumulatedText: string
  errorMessage: string | null

  openPrompt: (owner: unknown, target: InlineEditTarget) => void
  closePrompt: () => void
  startGenerating: (requestId: string) => void
  appendDelta: (requestId: string, text: string) => void
  finishGenerating: (requestId: string) => void
  fail: (requestId: string, message: string) => void
  reset: () => void
}

export const useInlineEditStore = create<InlineEditStore>((set, get) => ({
  status: 'idle',
  owner: null,
  requestId: null,
  target: null,
  accumulatedText: '',
  errorMessage: null,

  openPrompt: (owner, target) => set({
    status: 'prompting', owner, target, requestId: null, accumulatedText: '', errorMessage: null,
  }),

  closePrompt: () => set({ status: 'idle', owner: null, target: null }),

  startGenerating: (requestId) => set({ status: 'generating', requestId, accumulatedText: '', errorMessage: null }),

  appendDelta: (requestId, text) => {
    if (get().requestId !== requestId) return
    set((s) => ({ accumulatedText: s.accumulatedText + text }))
  },

  finishGenerating: (requestId) => {
    if (get().requestId !== requestId) return
    set({ status: 'reviewing' })
  },

  fail: (requestId, message) => {
    if (get().requestId !== requestId) return
    set({ status: 'error', errorMessage: message })
  },

  reset: () => set({
    status: 'idle', owner: null, requestId: null, target: null, accumulatedText: '', errorMessage: null,
  }),
}))
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx vitest run src/stores/__tests__/inlineEditStore.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stores/inlineEditStore.ts src/stores/__tests__/inlineEditStore.test.ts
git commit -m "Add inline edit renderer state machine store with per-editor ownership"
```

---

### Task 7: Renderer IPC client (event subscription + request correlation)

**Files:**
- Create: `src/lib/inlineEditClient.ts`
- Test: `src/lib/__tests__/inlineEditClient.test.ts`

**Interfaces:**
- Consumes: `useInlineEditStore` (Task 6); `window.api.inlineEditStart`, `window.api.inlineEditCancel`, `window.api.onInlineEditEvent` (Task 5).
- Produces: `subscribeToInlineEditEvents(): void` (idempotent, call once), `startInlineEdit(params: { prefix: string; suffix: string; selection: string; instruction: string; language: string; model: string }): void`, `cancelInlineEdit(): void`.
- Consumed by: Task 8 (Monaco wiring).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/inlineEditClient.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { subscribeToInlineEditEvents, startInlineEdit, cancelInlineEdit, _resetInlineEditClientForTesting } from '../inlineEditClient'
import { useInlineEditStore } from '@/stores/inlineEditStore'

describe('inlineEditClient', () => {
  beforeEach(() => {
    _resetInlineEditClientForTesting()
    useInlineEditStore.setState({
      status: 'idle', owner: null, requestId: null, target: null, accumulatedText: '', errorMessage: null,
    })
  })

  it('subscribeToInlineEditEvents only registers the IPC listener once', () => {
    const onInlineEditEvent = vi.fn()
    ;(global as any).window = { api: { onInlineEditEvent, inlineEditStart: vi.fn(), inlineEditCancel: vi.fn() } }

    subscribeToInlineEditEvents()
    subscribeToInlineEditEvents()

    expect(onInlineEditEvent).toHaveBeenCalledTimes(1)
  })

  it('routes a delta event to the store for the current request', () => {
    let handler: (event: any) => void = () => {}
    ;(global as any).window = {
      api: {
        onInlineEditEvent: (cb: (event: any) => void) => { handler = cb },
        inlineEditStart: vi.fn(),
        inlineEditCancel: vi.fn(),
      },
    }
    subscribeToInlineEditEvents()

    useInlineEditStore.getState().openPrompt({}, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 })
    useInlineEditStore.getState().startGenerating('req-1')

    handler({ type: 'delta', requestId: 'req-1', text: 'hello' })

    expect(useInlineEditStore.getState().accumulatedText).toBe('hello')
  })

  it('routes a done event to the store', () => {
    let handler: (event: any) => void = () => {}
    ;(global as any).window = {
      api: {
        onInlineEditEvent: (cb: (event: any) => void) => { handler = cb },
        inlineEditStart: vi.fn(),
        inlineEditCancel: vi.fn(),
      },
    }
    subscribeToInlineEditEvents()

    useInlineEditStore.getState().openPrompt({}, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 })
    useInlineEditStore.getState().startGenerating('req-1')
    handler({ type: 'done', requestId: 'req-1' })

    expect(useInlineEditStore.getState().status).toBe('reviewing')
  })

  it('routes an error event to the store', () => {
    let handler: (event: any) => void = () => {}
    ;(global as any).window = {
      api: {
        onInlineEditEvent: (cb: (event: any) => void) => { handler = cb },
        inlineEditStart: vi.fn(),
        inlineEditCancel: vi.fn(),
      },
    }
    subscribeToInlineEditEvents()

    useInlineEditStore.getState().openPrompt({}, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 })
    useInlineEditStore.getState().startGenerating('req-1')
    handler({ type: 'error', requestId: 'req-1', message: 'Something went wrong' })

    expect(useInlineEditStore.getState().status).toBe('error')
    expect(useInlineEditStore.getState().errorMessage).toBe('Something went wrong')
  })

  it('startInlineEdit generates a fresh request id each call and starts generating', () => {
    const inlineEditStart = vi.fn()
    ;(global as any).window = { api: { onInlineEditEvent: vi.fn(), inlineEditStart, inlineEditCancel: vi.fn() } }

    startInlineEdit({ prefix: 'a', suffix: 'b', selection: 'c', instruction: 'd', language: 'typescript', model: 'claude-sonnet-5' })
    const firstId = useInlineEditStore.getState().requestId

    startInlineEdit({ prefix: 'a', suffix: 'b', selection: 'c', instruction: 'd', language: 'typescript', model: 'claude-sonnet-5' })
    const secondId = useInlineEditStore.getState().requestId

    expect(firstId).not.toBeNull()
    expect(secondId).not.toBeNull()
    expect(firstId).not.toBe(secondId)
    expect(useInlineEditStore.getState().status).toBe('generating')
    expect(inlineEditStart).toHaveBeenCalledTimes(2)
    expect(inlineEditStart.mock.calls[1][0]).toMatchObject({
      requestId: secondId, prefix: 'a', suffix: 'b', selection: 'c', instruction: 'd', language: 'typescript', model: 'claude-sonnet-5',
    })
  })

  it('cancelInlineEdit calls the IPC bridge and resets the store', () => {
    const inlineEditCancel = vi.fn()
    ;(global as any).window = { api: { onInlineEditEvent: vi.fn(), inlineEditStart: vi.fn(), inlineEditCancel } }

    useInlineEditStore.getState().openPrompt({}, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 })
    useInlineEditStore.getState().startGenerating('req-1')

    cancelInlineEdit()

    expect(inlineEditCancel).toHaveBeenCalledTimes(1)
    expect(useInlineEditStore.getState().status).toBe('idle')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/inlineEditClient.test.ts`
Expected: FAIL — cannot find module `../inlineEditClient`

- [ ] **Step 3: Implement**

```ts
// src/lib/inlineEditClient.ts
import { useInlineEditStore } from '@/stores/inlineEditStore'

let nextRequestId = 0

function generateRequestId(): string {
  nextRequestId += 1
  return `inline-edit-${Date.now()}-${nextRequestId}`
}

let subscribed = false

export function subscribeToInlineEditEvents(): void {
  if (subscribed) return
  subscribed = true

  window.api.onInlineEditEvent((event) => {
    const store = useInlineEditStore.getState()
    if (event.type === 'delta') store.appendDelta(event.requestId, event.text)
    else if (event.type === 'done') store.finishGenerating(event.requestId)
    else store.fail(event.requestId, event.message)
  })
}

export function startInlineEdit(params: {
  prefix: string
  suffix: string
  selection: string
  instruction: string
  language: string
  model: string
}): void {
  const requestId = generateRequestId()
  useInlineEditStore.getState().startGenerating(requestId)
  window.api.inlineEditStart({
    requestId,
    prefix: params.prefix,
    suffix: params.suffix,
    selection: params.selection,
    instruction: params.instruction,
    language: params.language,
    model: params.model,
  })
}

export function cancelInlineEdit(): void {
  window.api.inlineEditCancel()
  useInlineEditStore.getState().reset()
}

export function _resetInlineEditClientForTesting(): void {
  subscribed = false
}
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx vitest run src/lib/__tests__/inlineEditClient.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/inlineEditClient.ts src/lib/__tests__/inlineEditClient.test.ts
git commit -m "Add inline edit renderer IPC client (event subscription, request correlation)"
```

---

### Task 8: Monaco integration — Cmd+K, prompt widget, diff preview, accept/reject

**Files:**
- Create: `src/lib/inlineEditMonaco.ts`
- Modify: `src/index.css` (add the `.inline-edit-removed` decoration class)
- Modify: `src/components/Editor/Editor.tsx` (call `registerInlineEditCommands` in the writable `MonacoEditor`'s `onMount`)

**Interfaces:**
- Consumes: `useInlineEditStore`, `InlineEditTarget` (Task 6); `useInlineEditSettingsStore` (Task 1); `startInlineEdit`, `cancelInlineEdit`, `subscribeToInlineEditEvents` (Task 7); `getCompletionContext` from `@/lib/autocompleteContext` (already implemented, do not modify).
- Produces: `registerInlineEditCommands(editor, monaco): void`, called once per editor mount (unlike `registerAutocompleteProvider`, this is **not** globally guarded — content widgets, decorations, and view zones are editor-instance-scoped, so each pane needs its own).

This task is Monaco-API-heavy glue with no meaningful pure-function surface to unit test beyond what Tasks 6–7 already cover — content widgets, decorations, and view zones all require a real Monaco instance. It is verified via typecheck, the full existing suite staying green, and the manual verification checklist at the end of this plan (matching how `registerAutocompleteProvider`'s own thin Monaco-registration wrapper was handled in the earlier autocomplete plan).

- [ ] **Step 1: Add the decoration CSS class**

Find in `src/index.css`:
```css
.search-reveal-highlight {
  background-color: rgba(255, 200, 0, 0.35);
  border-radius: 2px;
}
```

Replace with:
```css
.search-reveal-highlight {
  background-color: rgba(255, 200, 0, 0.35);
  border-radius: 2px;
}

.inline-edit-removed {
  text-decoration: line-through;
  background-color: rgba(248, 81, 73, 0.15);
}
```

- [ ] **Step 2: Implement the Monaco integration module**

```ts
// src/lib/inlineEditMonaco.ts
import { useInlineEditStore, type InlineEditTarget } from '@/stores/inlineEditStore'
import { useInlineEditSettingsStore } from '@/stores/inlineEditSettingsStore'
import { getCompletionContext } from './autocompleteContext'
import { startInlineEdit, cancelInlineEdit, subscribeToInlineEditEvents } from './inlineEditClient'
import type * as Monaco from 'monaco-editor'

export function registerInlineEditCommands(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco
): void {
  subscribeToInlineEditEvents()

  let promptWidget: Monaco.editor.IContentWidget | null = null
  let decorationIds: string[] = []
  let viewZoneId: string | null = null

  function targetRange(target: InlineEditTarget): Monaco.Range {
    return new monaco.Range(target.startLineNumber, target.startColumn, target.endLineNumber, target.endColumn)
  }

  function closePromptWidget() {
    if (!promptWidget) return
    editor.removeContentWidget(promptWidget)
    promptWidget = null
  }

  function clearDecorations() {
    decorationIds = editor.deltaDecorations(decorationIds, [])
  }

  function clearViewZone() {
    if (viewZoneId === null) return
    const id = viewZoneId
    viewZoneId = null
    editor.changeViewZones((accessor) => accessor.removeZone(id))
  }

  function renderZone(target: InlineEditTarget, text: string, isError: boolean) {
    const domNode = document.createElement('div')
    domNode.className = isError
      ? 'px-2 py-1 text-sm font-mono whitespace-pre-wrap bg-panel border-l-2 border-red-500 text-red-400'
      : 'px-2 py-1 text-sm font-mono whitespace-pre-wrap bg-panel border-l-2 border-accent text-fg'
    const displayText = text.length > 0 ? text : '…'
    domNode.textContent = displayText

    editor.changeViewZones((accessor) => {
      if (viewZoneId !== null) accessor.removeZone(viewZoneId)
      viewZoneId = accessor.addZone({
        afterLineNumber: target.endLineNumber,
        heightInLines: Math.max(1, displayText.split('\n').length),
        domNode,
      })
    })
  }

  function teardown() {
    closePromptWidget()
    clearDecorations()
    clearViewZone()
    editor.updateOptions({ readOnly: false })
  }

  function openPromptWidget(target: InlineEditTarget) {
    const container = document.createElement('div')
    container.className = 'bg-popover border border-border rounded-lg shadow-lg shadow-black/40 p-1.5 flex items-center gap-1.5'
    container.style.width = '360px'

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Describe the change…'
    input.className = 'flex-1 bg-bg border border-border rounded px-2 py-1 text-sm text-fg focus:outline-none focus:border-accent/60'
    container.appendChild(input)

    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        e.preventDefault()
        const instruction = input.value.trim()
        if (!instruction) return
        submit(target, instruction)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        closePromptWidget()
        useInlineEditStore.getState().closePrompt()
      }
    })

    const widget: Monaco.editor.IContentWidget = {
      getId: () => 'huginn.inlineEdit.prompt',
      getDomNode: () => container,
      getPosition: () => ({
        position: { lineNumber: target.startLineNumber, column: target.startColumn },
        preference: [
          monaco.editor.ContentWidgetPositionPreference.ABOVE,
          monaco.editor.ContentWidgetPositionPreference.BELOW,
        ],
      }),
    }

    promptWidget = widget
    editor.addContentWidget(widget)
    requestAnimationFrame(() => input.focus())
  }

  function submit(target: InlineEditTarget, instruction: string) {
    closePromptWidget()

    const model = editor.getModel()
    if (!model) return

    const range = targetRange(target)
    const selection = model.getValueInRange(range)
    const { prefix, suffix } = getCompletionContext(model, {
      lineNumber: target.startLineNumber,
      column: target.startColumn,
    })
    const language = model.getLanguageId()
    const selectedModel = useInlineEditSettingsStore.getState().model

    if (selection.length > 0) {
      decorationIds = editor.deltaDecorations(decorationIds, [{
        range,
        options: { inlineClassName: 'inline-edit-removed' },
      }])
    }

    editor.updateOptions({ readOnly: true })

    startInlineEdit({ prefix, suffix, selection, instruction, language, model: selectedModel })
  }

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
    if (!useInlineEditSettingsStore.getState().enabled) return

    const selection = editor.getSelection()
    if (!selection) return

    const target: InlineEditTarget = {
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn,
      endLineNumber: selection.endLineNumber,
      endColumn: selection.endColumn,
    }

    useInlineEditStore.getState().openPrompt(editor, target)
    openPromptWidget(target)
  })

  function acceptEdit() {
    const state = useInlineEditStore.getState()
    if (!state.target) return
    editor.executeEdits('inline-edit', [{ range: targetRange(state.target), text: state.accumulatedText }])
    state.reset()
  }

  editor.onKeyDown((e) => {
    const state = useInlineEditStore.getState()
    if (state.owner !== editor) return

    if (state.status === 'reviewing' && e.keyCode === monaco.KeyCode.Enter) {
      e.preventDefault()
      acceptEdit()
    } else if (state.status === 'generating' && e.keyCode === monaco.KeyCode.Escape) {
      e.preventDefault()
      cancelInlineEdit()
    } else if ((state.status === 'reviewing' || state.status === 'error') && e.keyCode === monaco.KeyCode.Escape) {
      e.preventDefault()
      useInlineEditStore.getState().reset()
    }
  })

  useInlineEditStore.subscribe((state) => {
    if (state.owner !== editor || state.status === 'idle') {
      teardown()
      return
    }
    if (!state.target || state.status === 'prompting') return

    if (state.status === 'error') {
      renderZone(state.target, state.errorMessage ?? 'Something went wrong', true)
    } else {
      renderZone(state.target, state.accumulatedText, false)
    }
  })
}
```

- [ ] **Step 3: Wire it into Editor.tsx**

Add the import near the other `@/lib`/store imports at the top of `src/components/Editor/Editor.tsx`:

```ts
import { registerInlineEditCommands } from '@/lib/inlineEditMonaco'
```

In the writable `MonacoEditor`'s `onMount`, find:
```tsx
              onMount={(editor, monaco) => {
                editorRef.current = editor
                registerAutocompleteProvider(monaco)
                editor.onDidFocusEditorWidget(activatePane)
```

Replace with:
```tsx
              onMount={(editor, monaco) => {
                editorRef.current = editor
                registerAutocompleteProvider(monaco)
                registerInlineEditCommands(editor, monaco)
                editor.onDidFocusEditorWidget(activatePane)
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: no new errors introduced.

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm test`
Expected: same pass/fail counts as before this task.

- [ ] **Step 6: Commit**

```bash
git add src/lib/inlineEditMonaco.ts src/index.css src/components/Editor/Editor.tsx
git commit -m "Wire Cmd+K inline edit into Monaco: prompt widget, diff preview, accept/reject"
```

---

### Task 9: Settings — "Inline Edit" section on the Models page

**Files:**
- Modify: `src/components/Settings/ModelsSettingsPage.tsx`
- Modify: `src/components/Settings/__tests__/ModelsSettingsPage.test.tsx`

**Interfaces:**
- Consumes: `useInlineEditSettingsStore` (Task 1); `AUTOCOMPLETE_MODELS` from `@/stores/autocompleteSettingsStore` (already implemented, reused as-is — same four models, no duplicate list).

- [ ] **Step 1: Write the failing tests (append to the existing test file)**

Add this import near the top of `src/components/Settings/__tests__/ModelsSettingsPage.test.tsx`:

```ts
import { useInlineEditSettingsStore } from '@/stores/inlineEditSettingsStore'
```

Add `useInlineEditSettingsStore.setState({ enabled: true, model: 'claude-sonnet-5' })` to the existing `afterEach` block, alongside the other store resets.

Append this new describe block at the end of the file:

```tsx
describe('ModelsSettingsPage inline edit section', () => {
  it('reflects the current enabled state', () => {
    useInlineEditSettingsStore.setState({ enabled: false })
    render(<ModelsSettingsPage />)
    expect(screen.getByRole('switch', { name: 'Inline Edit (Cmd+K)' })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles inline edit on click', () => {
    render(<ModelsSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Inline Edit (Cmd+K)' }))
    expect(useInlineEditSettingsStore.getState().enabled).toBe(false)
  })

  it('reflects the current model selection', () => {
    useInlineEditSettingsStore.setState({ model: 'claude-opus-5' })
    render(<ModelsSettingsPage />)
    expect((screen.getByLabelText('Inline Edit Model') as HTMLSelectElement).value).toBe('claude-opus-5')
  })

  it('updates the model when changed', () => {
    render(<ModelsSettingsPage />)
    fireEvent.change(screen.getByLabelText('Inline Edit Model'), { target: { value: 'claude-haiku-4-5-20251001' } })
    expect(useInlineEditSettingsStore.getState().model).toBe('claude-haiku-4-5-20251001')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/Settings/__tests__/ModelsSettingsPage.test.tsx`
Expected: FAIL — no switch/select with those accessible names exists yet.

- [ ] **Step 3: Implement**

Add this import to the top of `src/components/Settings/ModelsSettingsPage.tsx`:

```ts
import { useInlineEditSettingsStore } from '@/stores/inlineEditSettingsStore'
```

Inside the `ModelsSettingsPage` function, add alongside the existing store hooks:

```tsx
  const inlineEditEnabled = useInlineEditSettingsStore((s) => s.enabled)
  const setInlineEditEnabled = useInlineEditSettingsStore((s) => s.setEnabled)
  const inlineEditModel = useInlineEditSettingsStore((s) => s.model)
  const setInlineEditModel = useInlineEditSettingsStore((s) => s.setModel)
```

Find the closing of the Autocomplete `<section>` (the one ending right before the final `</div>\n    </div>\n  )\n}`):
```tsx
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle text-xs">
                ▾
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
```

Replace with:
```tsx
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle text-xs">
                ▾
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            Inline Edit
          </h2>

          <Toggle
            label="Inline Edit (Cmd+K)"
            description="Select code (or place your cursor) and press Cmd+K to describe a change."
            checked={inlineEditEnabled}
            onChange={setInlineEditEnabled}
          />

          <div>
            <label htmlFor="inline-edit-model" className="text-xs text-fg-muted mb-1.5 block">Inline Edit Model</label>
            <div className="relative">
              <select
                id="inline-edit-model"
                value={inlineEditModel}
                onChange={(e) => setInlineEditModel(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 pr-9 text-sm bg-bg border border-border rounded-lg text-fg focus:outline-none focus:border-accent/60 transition-colors cursor-pointer"
              >
                {AUTOCOMPLETE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle text-xs">
                ▾
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
```

(Note the label text is "Inline Edit Model", not "Model" — the Autocomplete section already uses the plain "Model" label with `id="autocomplete-model"`; using a distinct label text and a distinct `id="inline-edit-model"` keeps `getByLabelText` unambiguous between the two sections on the same page.)

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx vitest run src/components/Settings/__tests__/ModelsSettingsPage.test.tsx`
Expected: PASS (all tests: the existing Assistants/Cosmos/Autocomplete tests + 4 new Inline Edit tests)

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test`
Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: full suite green, no new typecheck errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings/ModelsSettingsPage.tsx src/components/Settings/__tests__/ModelsSettingsPage.test.tsx
git commit -m "Add Inline Edit section (enable toggle + model picker) to Models settings"
```

---

## Manual verification (after all tasks)

Automated tests cover the manager's streaming/supersede/timeout logic, the
renderer state machine's transitions and ownership filtering, and the IPC
client's event routing and request correlation — but the actual Monaco UX
(content widget placement, decoration styling, view zone growth, keyboard
handling) can only be verified by running the app:

1. `npm run dev`, open a project, open a code file with at least a few
   functions in it.
2. Select a block of code, press Cmd+K — a small input box should appear
   near the selection, focused. Type an instruction (e.g. "add a doc
   comment") and press Enter.
3. The input box should close; the selected code should show a
   strikethrough/red tint; a preview box should appear below it and fill
   in with streamed text over the next few seconds (expect several
   seconds — this uses the same `claude -p` CLI whose latency was
   measured at 3-8s for autocomplete, and Sonnet is the default model
   here rather than the faster Haiku, so allow more).
4. Once streaming finishes, press Enter — the selection should be replaced
   with the generated code, and the strikethrough/preview should vanish.
5. Repeat, but press Esc instead once the preview finishes — the selection
   should be restored to its original text with no changes applied.
6. Repeat, but press Esc *while it's still streaming* — the request should
   cancel immediately and the UI should clear with no error shown.
7. Place the cursor on a blank line with no selection, press Cmd+K, and
   ask for something to be generated (e.g. "add a console.log") — confirm
   it inserts at the cursor rather than replacing anything.
8. Force an error (e.g. temporarily rename the `claude` binary, or select
   an enormous block of text past reasonable limits) and confirm the
   preview box shows a visible error message rather than failing silently
   — this is the one place inline edit is intentionally *not* silent like
   autocomplete.
9. Split the editor into two panes (Cmd+D), start a Cmd+K session in the
   left pane, then click into the right pane and press Cmd+K there before
   the left one finishes — confirm the left pane's preview disappears
   (superseded) and only the right pane shows a live session, never both
   at once.
10. Open Settings → Models, toggle "Inline Edit (Cmd+K)" off, confirm
    Cmd+K does nothing while disabled, and toggle it back on. Change the
    Inline Edit model dropdown and confirm a subsequent Cmd+K session
    still works.
