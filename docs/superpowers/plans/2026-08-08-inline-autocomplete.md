# Inline Autocomplete (Ghost-Text Completions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cursor-style inline ghost-text code completion to Huginn's Monaco editor, powered by the user's existing `claude` CLI subscription (no API key), with a 3-state status-bar icon and settings-page controls.

**Architecture:** A new `AutocompleteManager` in the Electron main process spawns one-shot `claude -p` child processes per suggestion (killing any prior in-flight one for the same window). The renderer registers a single global Monaco `InlineCompletionsProvider` that debounces via Monaco's own cancellation tokens, reads/writes small zustand stores for settings/session-pause/busy state, and calls the manager over IPC. A status bar icon reflects effective on/working/off state and exposes a click/right-click popup for a session-only pause, independent of the persisted Settings toggle.

**Tech Stack:** Electron (`child_process`), Monaco (`@monaco-editor/react`, `registerInlineCompletionsProvider`), zustand, vitest + `@testing-library/react`.

## Global Constraints

- Never pass `--bare` to the `claude` CLI — it restricts auth to `ANTHROPIC_API_KEY`/`apiKeyHelper` and skips keychain reads, which breaks the subscription OAuth this feature depends on.
- Never invoke `claude` through a shell with interpolated content (no `spawn(..., { shell: true })`, no building a command string). Prefix/suffix content is arbitrary user file content and must reach the CLI only as literal `argv` elements via array-form `spawn`.
- Debounce: 700ms after the last keystroke, implemented via Monaco's own per-call `CancellationToken` (no manual timer bookkeeping).
- Context caps: prefix up to 100 lines / 4000 chars before the cursor; suffix up to 50 lines / 2000 chars after. Current file only — no other open tabs.
- Per-request timeout: 10 seconds, after which the child process is killed and the request resolves `null`.
- Default model: `claude-haiku-4-5-20251001` (Haiku 4.5). Other selectable models: `claude-sonnet-5` (Sonnet 5), `claude-opus-5` (Opus 5), `claude-fable-5` (Fable 5).
- Errors (CLI not found, non-zero exit, timeout, empty response) resolve `null` silently — no toast, no terminal output surfaced to the user.
- Two independent enable layers: the persisted Settings → Editor toggle (`autocompleteSettingsStore.enabled`, source of truth) and an in-memory, non-persisted session pause (`autocompleteSessionStore.paused`). Effective state = `enabled && !paused`. When the Settings toggle is off, the status-bar popup shows only an informational message — never a session toggle.

---

### Task 1: Autocomplete state stores

**Files:**
- Create: `src/stores/autocompleteSettingsStore.ts`
- Create: `src/stores/autocompleteSessionStore.ts`
- Create: `src/stores/autocompleteStatusStore.ts`
- Create: `src/lib/autocompleteEffectiveState.ts`
- Test: `src/stores/__tests__/autocompleteSettingsStore.test.ts`
- Test: `src/stores/__tests__/autocompleteSessionStore.test.ts`
- Test: `src/stores/__tests__/autocompleteStatusStore.test.ts`
- Test: `src/lib/__tests__/autocompleteEffectiveState.test.ts`

**Interfaces:**
- Produces: `useAutocompleteSettingsStore` with state `{ enabled: boolean, model: string }` and actions `setEnabled(value: boolean)`, `setModel(value: string)`. Also exports `AUTOCOMPLETE_MODELS: { id: string; label: string }[]`.
- Produces: `useAutocompleteSessionStore` with state `{ paused: boolean }` and action `togglePaused()`.
- Produces: `useAutocompleteStatusStore` with state `{ busy: boolean }` and action `setBusy(value: boolean)`.
- Produces: `isAutocompleteEffectivelyEnabled(): boolean`, reading both stores' `getState()`.
- Consumed later by: Task 7 (provider), Task 8 (status bar icon), Task 9 (settings page).

- [ ] **Step 1: Write the failing tests for the settings store**

```ts
// src/stores/__tests__/autocompleteSettingsStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

const { store } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  return { store }
})
import { vi } from 'vitest'

import { useAutocompleteSettingsStore, AUTOCOMPLETE_MODELS } from '../autocompleteSettingsStore'

describe('autocompleteSettingsStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    useAutocompleteSettingsStore.setState({ enabled: true, model: 'claude-haiku-4-5-20251001' })
  })

  it('defaults to enabled with Haiku 4.5 as the model', () => {
    expect(useAutocompleteSettingsStore.getState().enabled).toBe(true)
    expect(useAutocompleteSettingsStore.getState().model).toBe('claude-haiku-4-5-20251001')
  })

  it('lists Haiku 4.5, Sonnet 5, Opus 5, and Fable 5 as selectable models', () => {
    expect(AUTOCOMPLETE_MODELS.map((m) => m.id)).toEqual([
      'claude-haiku-4-5-20251001',
      'claude-sonnet-5',
      'claude-opus-5',
      'claude-fable-5',
    ])
  })

  it('setEnabled persists to localStorage', () => {
    useAutocompleteSettingsStore.getState().setEnabled(false)
    expect(useAutocompleteSettingsStore.getState().enabled).toBe(false)
    expect(store['huginn:autocomplete:enabled']).toBe('false')
  })

  it('setModel persists to localStorage', () => {
    useAutocompleteSettingsStore.getState().setModel('claude-opus-5')
    expect(useAutocompleteSettingsStore.getState().model).toBe('claude-opus-5')
    expect(store['huginn:autocomplete:model']).toBe('claude-opus-5')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/stores/__tests__/autocompleteSettingsStore.test.ts`
Expected: FAIL — cannot find module `../autocompleteSettingsStore`

- [ ] **Step 3: Implement the settings store**

```ts
// src/stores/autocompleteSettingsStore.ts
import { create } from 'zustand'

const KEYS = {
  enabled: 'huginn:autocomplete:enabled',
  model: 'huginn:autocomplete:model',
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

export const AUTOCOMPLETE_MODELS: { id: string; label: string }[] = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5' },
  { id: 'claude-opus-5', label: 'Opus 5' },
  { id: 'claude-fable-5', label: 'Fable 5' },
]

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

interface AutocompleteSettingsStore {
  enabled: boolean
  model: string
  setEnabled: (value: boolean) => void
  setModel: (value: string) => void
}

export const useAutocompleteSettingsStore = create<AutocompleteSettingsStore>((set) => ({
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

Run: `npx vitest run src/stores/__tests__/autocompleteSettingsStore.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing test for the session-pause store**

```ts
// src/stores/__tests__/autocompleteSessionStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAutocompleteSessionStore } from '../autocompleteSessionStore'

describe('autocompleteSessionStore', () => {
  beforeEach(() => {
    useAutocompleteSessionStore.setState({ paused: false })
  })

  it('defaults to not paused', () => {
    expect(useAutocompleteSessionStore.getState().paused).toBe(false)
  })

  it('togglePaused flips the flag', () => {
    useAutocompleteSessionStore.getState().togglePaused()
    expect(useAutocompleteSessionStore.getState().paused).toBe(true)
    useAutocompleteSessionStore.getState().togglePaused()
    expect(useAutocompleteSessionStore.getState().paused).toBe(false)
  })
})
```

- [ ] **Step 6: Run it to verify it fails, then implement**

Run: `npx vitest run src/stores/__tests__/autocompleteSessionStore.test.ts` — expect FAIL (module not found).

```ts
// src/stores/autocompleteSessionStore.ts
import { create } from 'zustand'

interface AutocompleteSessionStore {
  paused: boolean
  togglePaused: () => void
}

// Deliberately not persisted to localStorage: this is a same-session-only
// pause layered on top of the persisted Settings toggle, and resets to
// "not paused" every app launch by simply never being written to disk.
export const useAutocompleteSessionStore = create<AutocompleteSessionStore>((set) => ({
  paused: false,
  togglePaused: () => set((s) => ({ paused: !s.paused })),
}))
```

Run again: `npx vitest run src/stores/__tests__/autocompleteSessionStore.test.ts` — expect PASS (2 tests).

- [ ] **Step 7: Write the failing test for the busy/status store**

```ts
// src/stores/__tests__/autocompleteStatusStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAutocompleteStatusStore } from '../autocompleteStatusStore'

describe('autocompleteStatusStore', () => {
  beforeEach(() => {
    useAutocompleteStatusStore.setState({ busy: false })
  })

  it('defaults to not busy', () => {
    expect(useAutocompleteStatusStore.getState().busy).toBe(false)
  })

  it('setBusy updates the flag', () => {
    useAutocompleteStatusStore.getState().setBusy(true)
    expect(useAutocompleteStatusStore.getState().busy).toBe(true)
  })
})
```

- [ ] **Step 8: Run it to verify it fails, then implement**

Run: `npx vitest run src/stores/__tests__/autocompleteStatusStore.test.ts` — expect FAIL.

```ts
// src/stores/autocompleteStatusStore.ts
import { create } from 'zustand'

interface AutocompleteStatusStore {
  busy: boolean
  setBusy: (value: boolean) => void
}

export const useAutocompleteStatusStore = create<AutocompleteStatusStore>((set) => ({
  busy: false,
  setBusy: (value) => set({ busy: value }),
}))
```

Run again: `npx vitest run src/stores/__tests__/autocompleteStatusStore.test.ts` — expect PASS (2 tests).

- [ ] **Step 9: Write the failing test for the effective-state helper**

```ts
// src/lib/__tests__/autocompleteEffectiveState.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { isAutocompleteEffectivelyEnabled } from '../autocompleteEffectiveState'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteSessionStore } from '@/stores/autocompleteSessionStore'

describe('isAutocompleteEffectivelyEnabled', () => {
  beforeEach(() => {
    useAutocompleteSettingsStore.setState({ enabled: true })
    useAutocompleteSessionStore.setState({ paused: false })
  })

  it('is true when enabled and not paused', () => {
    expect(isAutocompleteEffectivelyEnabled()).toBe(true)
  })

  it('is false when disabled in settings', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    expect(isAutocompleteEffectivelyEnabled()).toBe(false)
  })

  it('is false when session-paused', () => {
    useAutocompleteSessionStore.setState({ paused: true })
    expect(isAutocompleteEffectivelyEnabled()).toBe(false)
  })

  it('is false when both disabled and paused', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    useAutocompleteSessionStore.setState({ paused: true })
    expect(isAutocompleteEffectivelyEnabled()).toBe(false)
  })
})
```

- [ ] **Step 10: Run it to verify it fails, then implement**

Run: `npx vitest run src/lib/__tests__/autocompleteEffectiveState.test.ts` — expect FAIL.

```ts
// src/lib/autocompleteEffectiveState.ts
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteSessionStore } from '@/stores/autocompleteSessionStore'

export function isAutocompleteEffectivelyEnabled(): boolean {
  return useAutocompleteSettingsStore.getState().enabled && !useAutocompleteSessionStore.getState().paused
}
```

Run again: `npx vitest run src/lib/__tests__/autocompleteEffectiveState.test.ts` — expect PASS (4 tests).

- [ ] **Step 11: Commit**

```bash
git add src/stores/autocompleteSettingsStore.ts src/stores/autocompleteSessionStore.ts src/stores/autocompleteStatusStore.ts src/lib/autocompleteEffectiveState.ts src/stores/__tests__/autocompleteSettingsStore.test.ts src/stores/__tests__/autocompleteSessionStore.test.ts src/stores/__tests__/autocompleteStatusStore.test.ts src/lib/__tests__/autocompleteEffectiveState.test.ts
git commit -m "Add autocomplete state stores (settings, session pause, busy status)"
```

---

### Task 2: Prompt building and response post-processing (pure functions)

**Files:**
- Create: `electron/autocomplete.ts` (this task writes only the pure-function portion; Task 4 extends the same file)
- Test: `electron/__tests__/autocomplete.test.ts` (this task writes only the pure-function tests; Task 4 replaces this file with a fuller version that keeps these tests)

**Interfaces:**
- Produces: `buildSystemPrompt(): string`, `buildUserPrompt(prefix: string, suffix: string, language: string): string`, `postProcessCompletion(raw: string): string | null`.
- Consumed by: Task 4's `AutocompleteManager`.

- [ ] **Step 1: Write the failing tests**

```ts
// electron/__tests__/autocomplete.test.ts
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildUserPrompt, postProcessCompletion } from '../autocomplete'

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
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run electron/__tests__/autocomplete.test.ts`
Expected: FAIL — cannot find module `../autocomplete`

- [ ] **Step 3: Implement the pure functions**

```ts
// electron/autocomplete.ts
const SYSTEM_PROMPT = `You are a code-completion engine embedded in a code editor. You will be given the code immediately before the cursor (<prefix>) and immediately after the cursor (<suffix>). Respond with ONLY the exact text that should be inserted at the cursor to continue the code naturally — no explanations, no markdown code fences, no repeating text that already appears in the prefix or suffix. If no reasonable completion exists, respond with nothing.`

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildUserPrompt(prefix: string, suffix: string, language: string): string {
  return `Language: ${language}\n<prefix>\n${prefix}\n</prefix>\n<suffix>\n${suffix}\n</suffix>`
}

export function postProcessCompletion(raw: string): string | null {
  let text = raw.trim()
  if (!text) return null

  const fenced = text.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n?```$/)
  if (fenced) text = fenced[1].trim()

  return text.length > 0 ? text : null
}
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx vitest run electron/__tests__/autocomplete.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add electron/autocomplete.ts electron/__tests__/autocomplete.test.ts
git commit -m "Add autocomplete prompt-building and response post-processing"
```

---

### Task 3: Renderer-side completion context extraction

**Files:**
- Create: `src/lib/autocompleteContext.ts`
- Test: `src/lib/__tests__/autocompleteContext.test.ts`

**Interfaces:**
- Produces: `TextModelLike` interface (`getLineCount()`, `getLineMaxColumn(lineNumber)`, `getValueInRange(range)`), `PositionLike` interface (`lineNumber`, `column`), and `getCompletionContext(model: TextModelLike, position: PositionLike): { prefix: string; suffix: string }`. `TextModelLike` is a structural subset of Monaco's real `ITextModel`, so a real Monaco model satisfies it without any adapter.
- Consumed by: Task 7's Monaco provider.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/autocompleteContext.test.ts
import { describe, it, expect } from 'vitest'
import { getCompletionContext, type TextModelLike } from '../autocompleteContext'

function makeModel(lines: string[]): TextModelLike {
  return {
    getLineCount: () => lines.length,
    getLineMaxColumn: (lineNumber: number) => lines[lineNumber - 1].length + 1,
    getValueInRange: (range) => {
      const result: string[] = []
      for (let ln = range.startLineNumber; ln <= range.endLineNumber; ln++) {
        const line = lines[ln - 1]
        const start = ln === range.startLineNumber ? range.startColumn - 1 : 0
        const end = ln === range.endLineNumber ? range.endColumn - 1 : line.length
        result.push(line.slice(start, end))
      }
      return result.join('\n')
    },
  }
}

describe('getCompletionContext', () => {
  it('splits prefix and suffix at the cursor position', () => {
    const model = makeModel(['const x = 1', 'const y = 2', 'const z = 3'])
    const { prefix, suffix } = getCompletionContext(model, { lineNumber: 2, column: 8 })
    expect(prefix).toBe('const x = 1\nconst y')
    expect(suffix).toBe(' = 2\nconst z = 3')
  })

  it('caps the prefix to the last 100 lines before the cursor', () => {
    const lines = Array.from({ length: 150 }, (_, i) => `line${i + 1}`)
    const model = makeModel(lines)
    const { prefix } = getCompletionContext(model, { lineNumber: 150, column: 1 })
    const prefixLines = prefix.split('\n')
    expect(prefixLines.length).toBe(100)
    expect(prefixLines[0]).toBe('line51')
  })

  it('caps the suffix to 50 lines after the cursor (inclusive of the cursor line)', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line${i + 1}`)
    const model = makeModel(lines)
    const { suffix } = getCompletionContext(model, { lineNumber: 1, column: 1 })
    expect(suffix.split('\n').length).toBe(50)
  })

  it('does not run past the start of the file', () => {
    const model = makeModel(['only line'])
    const { prefix } = getCompletionContext(model, { lineNumber: 1, column: 5 })
    expect(prefix).toBe('only')
  })

  it('does not run past the end of the file', () => {
    const model = makeModel(['only line'])
    const { suffix } = getCompletionContext(model, { lineNumber: 1, column: 5 })
    expect(suffix).toBe(' line')
  })

  it('caps prefix length to 4000 characters', () => {
    const model = makeModel(['x'.repeat(5000)])
    const { prefix } = getCompletionContext(model, { lineNumber: 1, column: 5001 })
    expect(prefix.length).toBe(4000)
  })

  it('caps suffix length to 2000 characters', () => {
    const model = makeModel(['x'.repeat(5000)])
    const { suffix } = getCompletionContext(model, { lineNumber: 1, column: 1 })
    expect(suffix.length).toBe(2000)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/autocompleteContext.test.ts`
Expected: FAIL — cannot find module `../autocompleteContext`

- [ ] **Step 3: Implement**

```ts
// src/lib/autocompleteContext.ts
export interface TextModelLike {
  getLineCount(): number
  getLineMaxColumn(lineNumber: number): number
  getValueInRange(range: {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }): string
}

export interface PositionLike {
  lineNumber: number
  column: number
}

const MAX_PREFIX_LINES = 100
const MAX_SUFFIX_LINES = 50
const MAX_PREFIX_CHARS = 4000
const MAX_SUFFIX_CHARS = 2000

export function getCompletionContext(
  model: TextModelLike,
  position: PositionLike
): { prefix: string; suffix: string } {
  const startLine = Math.max(1, position.lineNumber - MAX_PREFIX_LINES + 1)
  const endLine = Math.min(model.getLineCount(), position.lineNumber + MAX_SUFFIX_LINES - 1)

  const prefix = model.getValueInRange({
    startLineNumber: startLine,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  })

  const suffix = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: position.column,
    endLineNumber: endLine,
    endColumn: model.getLineMaxColumn(endLine),
  })

  return {
    prefix: prefix.slice(-MAX_PREFIX_CHARS),
    suffix: suffix.slice(0, MAX_SUFFIX_CHARS),
  }
}
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx vitest run src/lib/__tests__/autocompleteContext.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/autocompleteContext.ts src/lib/__tests__/autocompleteContext.test.ts
git commit -m "Add renderer-side completion context extraction with line/char caps"
```

---

### Task 4: AutocompleteManager (spawns `claude -p`, per-window supersede, PATH resolution)

**Files:**
- Modify: `electron/autocomplete.ts` (append to the file created in Task 2)
- Modify: `electron/__tests__/autocomplete.test.ts` (replace with the fuller version below, which keeps Task 2's tests and adds new ones)

**Interfaces:**
- Consumes: `buildSystemPrompt`, `buildUserPrompt`, `postProcessCompletion` from Task 2 (same file).
- Produces: `resolveClaudePath(): Promise<string | null>`, `_resetClaudePathCacheForTesting(): void`, `class AutocompleteManager { registerHandlers(): void; disposeWindow(windowId: number): void }`.
- Consumed by: Task 5 (`main.ts` wiring).

- [ ] **Step 1: Write the failing tests (full replacement of the test file)**

```ts
// electron/__tests__/autocomplete.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

    const [command, args] = spawnMock.mock.calls[0]
    expect(command).toBe('/usr/local/bin/claude')
    expect(args).toContain('-p')
    expect(args[args.indexOf('--model') + 1]).toBe('claude-opus-5')
    expect(args[args.indexOf('--output-format') + 1]).toBe('text')
    expect(args).toContain('--no-session-persistence')
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
```

Note: `flushMicrotasks()` (a `setTimeout(…, 0)` round-trip) after starting a request lets the manager's internal `await resolveClaudePath()` settle before the next call, so `spawn` has actually been invoked and stored in `currentByWindow` by the time the "supersede" assertions run — a macrotask tick drains any number of pending microtask hops, so the test doesn't need to know exactly how many `await`s sit inside `complete()`.

- [ ] **Step 2: Run it to verify the new tests fail**

Run: `npx vitest run electron/__tests__/autocomplete.test.ts`
Expected: FAIL — `resolveClaudePath`, `_resetClaudePathCacheForTesting`, and `AutocompleteManager` are not exported yet.

- [ ] **Step 3: Append the manager implementation**

Add to the bottom of `electron/autocomplete.ts` (keep the Task 2 content above it unchanged):

```ts
import { BrowserWindow, ipcMain } from 'electron'
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'child_process'

const TIMEOUT_MS = 10000

// Electron-launched apps on macOS don't inherit the interactive shell's PATH,
// so a bare spawn('claude', ...) fails whenever the CLI lives outside the
// default system PATH (e.g. ~/.local/bin, nvm — exactly how it's installed
// here). Resolve the absolute path once via a login shell and cache it, then
// spawn that path directly for every real completion request: this avoids
// paying a login shell's startup cost on every keystroke, and avoids ever
// shell-interpreting the prompt content (arbitrary user code) on every call.
let cachedClaudePath: string | null | undefined

export function resolveClaudePath(): Promise<string | null> {
  if (cachedClaudePath !== undefined) return Promise.resolve(cachedClaudePath)

  return new Promise((resolve) => {
    const shell = process.env.SHELL ?? '/bin/zsh'
    execFile(shell, ['-lic', 'command -v claude'], (err, stdout) => {
      const resolved = !err && stdout ? stdout.toString().trim() : ''
      cachedClaudePath = resolved.length > 0 ? resolved : null
      resolve(cachedClaudePath)
    })
  })
}

export function _resetClaudePathCacheForTesting(): void {
  cachedClaudePath = undefined
}

export class AutocompleteManager {
  private currentByWindow = new Map<number, ChildProcessWithoutNullStreams>()

  registerHandlers(): void {
    resolveClaudePath()

    ipcMain.handle(
      'autocomplete:complete',
      (event, prefix: string, suffix: string, language: string, model: string) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) return Promise.resolve(null)
        return this.complete(win.id, prefix, suffix, language, model)
      }
    )
  }

  disposeWindow(windowId: number): void {
    this.currentByWindow.get(windowId)?.kill()
    this.currentByWindow.delete(windowId)
  }

  private async complete(
    windowId: number,
    prefix: string,
    suffix: string,
    language: string,
    model: string
  ): Promise<string | null> {
    this.currentByWindow.get(windowId)?.kill()

    const claudePath = await resolveClaudePath()
    if (!claudePath) return null

    return new Promise((resolve) => {
      const proc = spawn(
        claudePath,
        [
          '-p', buildUserPrompt(prefix, suffix, language),
          '--model', model,
          '--output-format', 'text',
          '--no-session-persistence',
          '--tools', '',
          '--setting-sources', '',
          '--system-prompt', buildSystemPrompt(),
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      ) as ChildProcessWithoutNullStreams

      this.currentByWindow.set(windowId, proc)

      let stdout = ''
      let settled = false

      const finish = (result: string | null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (this.currentByWindow.get(windowId) === proc) this.currentByWindow.delete(windowId)
        resolve(result)
      }

      const timer = setTimeout(() => {
        proc.kill()
        finish(null)
      }, TIMEOUT_MS)

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      proc.on('error', () => finish(null))
      proc.on('close', (code) => {
        if (code !== 0) { finish(null); return }
        finish(postProcessCompletion(stdout))
      })
    })
  }
}
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx vitest run electron/__tests__/autocomplete.test.ts`
Expected: PASS (all tests: 6 from Task 2 + resolveClaudePath + manager tests)

- [ ] **Step 5: Commit**

```bash
git add electron/autocomplete.ts electron/__tests__/autocomplete.test.ts
git commit -m "Add AutocompleteManager: spawns claude -p, resolves PATH once, supersedes per window"
```

---

### Task 5: Wire AutocompleteManager into main.ts

**Files:**
- Modify: `electron/main.ts`

**Interfaces:**
- Consumes: `AutocompleteManager` from Task 4 (`./autocomplete`).

- [ ] **Step 1: Import the manager**

In `electron/main.ts`, add to the import block (after the `CosmosManager` import):

```ts
import { CosmosManager } from './cosmos'
import { AutocompleteManager } from './autocomplete'
```

- [ ] **Step 2: Declare the module-level manager variable**

Find:
```ts
let ptyMgr: PtyManager
let claudeMgr: ClaudeManager
let gitWatcher: GitWatcher
let cosmosMgr: CosmosManager
let browserViewMgr: BrowserViewManager
```

Replace with:
```ts
let ptyMgr: PtyManager
let claudeMgr: ClaudeManager
let gitWatcher: GitWatcher
let cosmosMgr: CosmosManager
let browserViewMgr: BrowserViewManager
let autocompleteMgr: AutocompleteManager
```

- [ ] **Step 3: Construct and register it in `whenReady()`**

Find:
```ts
  browserViewMgr = new BrowserViewManager()
  browserViewMgr.registerHandlers()

  buildMenu()
```

Replace with:
```ts
  browserViewMgr = new BrowserViewManager()
  browserViewMgr.registerHandlers()
  autocompleteMgr = new AutocompleteManager()
  autocompleteMgr.registerHandlers()

  buildMenu()
```

- [ ] **Step 4: Dispose it on window close**

Find:
```ts
  win.on('closed', () => {
    windows.delete(win.id)
    ptyMgr.disposeWindow(win.id)
    claudeMgr.disposeWindow(win.id)
    gitWatcher.disposeWindow(win.id)
    cosmosMgr.disposeWindow(win.id)
    browserViewMgr.disposeWindow(win.id)
    buildMenu()
  })
```

Replace with:
```ts
  win.on('closed', () => {
    windows.delete(win.id)
    ptyMgr.disposeWindow(win.id)
    claudeMgr.disposeWindow(win.id)
    gitWatcher.disposeWindow(win.id)
    cosmosMgr.disposeWindow(win.id)
    browserViewMgr.disposeWindow(win.id)
    autocompleteMgr.disposeWindow(win.id)
    buildMenu()
  })
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.node.json`
Expected: no new errors introduced (the pre-existing baseline errors in `cosmos.ts`/`git.ts`, if any, are unrelated and unaffected).

- [ ] **Step 6: Commit**

```bash
git add electron/main.ts
git commit -m "Wire AutocompleteManager into the Electron main process"
```

---

### Task 6: IPC bridge — preload.ts and api.d.ts

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/types/api.d.ts`

**Interfaces:**
- Produces: `window.api.autocompleteComplete(prefix: string, suffix: string, language: string, model: string): Promise<string | null>`.
- Consumed by: Task 7's Monaco provider.

- [ ] **Step 1: Add the bridge method in preload.ts**

Find:
```ts
  setWindowTitle: (root: string) => ipcRenderer.send('window:setTitle', root),
})
```

Replace with:
```ts
  setWindowTitle: (root: string) => ipcRenderer.send('window:setTitle', root),

  autocompleteComplete: (prefix: string, suffix: string, language: string, model: string) =>
    ipcRenderer.invoke('autocomplete:complete', prefix, suffix, language, model),
})
```

- [ ] **Step 2: Add the type declaration in api.d.ts**

Find:
```ts
      setWindowTitle: (root: string) => void
    }
  }
}
```

Replace with:
```ts
      setWindowTitle: (root: string) => void

      autocompleteComplete: (prefix: string, suffix: string, language: string, model: string) => Promise<string | null>
    }
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json`
Expected: no new errors introduced.

- [ ] **Step 4: Commit**

```bash
git add electron/preload.ts src/types/api.d.ts
git commit -m "Expose autocompleteComplete over the preload IPC bridge"
```

---

### Task 7: Monaco inline completions provider

**Files:**
- Create: `src/lib/monacoAutocomplete.ts`
- Test: `src/lib/__tests__/monacoAutocomplete.test.ts`
- Modify: `src/components/Editor/Editor.tsx`

**Interfaces:**
- Consumes: `getCompletionContext`, `TextModelLike`, `PositionLike` (Task 3); `isAutocompleteEffectivelyEnabled` (Task 1); `useAutocompleteStatusStore`, `useAutocompleteSettingsStore` (Task 1); `window.api.autocompleteComplete` (Task 6).
- Produces: `provideInlineCompletion(model, position, token): Promise<InlineCompletionItem[]>` and `registerAutocompleteProvider(monaco): void`, consumed by `Editor.tsx`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/monacoAutocomplete.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { provideInlineCompletion } from '../monacoAutocomplete'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteSessionStore } from '@/stores/autocompleteSessionStore'
import { useAutocompleteStatusStore } from '@/stores/autocompleteStatusStore'

function fakeModel() {
  return {
    getLineCount: () => 1,
    getLineMaxColumn: () => 1,
    getValueInRange: () => '',
    getLanguageId: () => 'typescript',
  }
}

function fakeToken(cancelled = false) {
  return { isCancellationRequested: cancelled }
}

describe('provideInlineCompletion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAutocompleteSettingsStore.setState({ enabled: true, model: 'claude-haiku-4-5-20251001' })
    useAutocompleteSessionStore.setState({ paused: false })
    useAutocompleteStatusStore.setState({ busy: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns no items immediately when disabled in settings', async () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    ;(global as any).window = { api: { autocompleteComplete: vi.fn() } }

    const result = await provideInlineCompletion(fakeModel(), { lineNumber: 1, column: 1 }, fakeToken())

    expect(result).toEqual([])
    expect(window.api.autocompleteComplete).not.toHaveBeenCalled()
  })

  it('returns no items immediately when session-paused', async () => {
    useAutocompleteSessionStore.setState({ paused: true })
    ;(global as any).window = { api: { autocompleteComplete: vi.fn() } }

    const result = await provideInlineCompletion(fakeModel(), { lineNumber: 1, column: 1 }, fakeToken())

    expect(result).toEqual([])
    expect(window.api.autocompleteComplete).not.toHaveBeenCalled()
  })

  it('returns no items if cancelled during the debounce wait', async () => {
    const token = fakeToken(false)
    ;(global as any).window = { api: { autocompleteComplete: vi.fn().mockResolvedValue('x') } }

    const promise = provideInlineCompletion(fakeModel(), { lineNumber: 1, column: 1 }, token)
    token.isCancellationRequested = true
    await vi.advanceTimersByTimeAsync(700)

    expect(await promise).toEqual([])
    expect(window.api.autocompleteComplete).not.toHaveBeenCalled()
  })

  it('calls the IPC bridge after the debounce and returns an insertable item', async () => {
    const apiMock = vi.fn().mockResolvedValue('console.log()')
    ;(global as any).window = { api: { autocompleteComplete: apiMock } }

    const promise = provideInlineCompletion(fakeModel(), { lineNumber: 3, column: 5 }, fakeToken())
    await vi.advanceTimersByTimeAsync(700)
    const result = await promise

    expect(apiMock).toHaveBeenCalledWith('', '', 'typescript', 'claude-haiku-4-5-20251001')
    expect(result).toEqual([{
      insertText: 'console.log()',
      range: { startLineNumber: 3, startColumn: 5, endLineNumber: 3, endColumn: 5 },
    }])
  })

  it('toggles the busy status store around the IPC call', async () => {
    let busyDuringCall = false
    const apiMock = vi.fn().mockImplementation(async () => {
      busyDuringCall = useAutocompleteStatusStore.getState().busy
      return 'x'
    })
    ;(global as any).window = { api: { autocompleteComplete: apiMock } }

    const promise = provideInlineCompletion(fakeModel(), { lineNumber: 1, column: 1 }, fakeToken())
    await vi.advanceTimersByTimeAsync(700)
    await promise

    expect(busyDuringCall).toBe(true)
    expect(useAutocompleteStatusStore.getState().busy).toBe(false)
  })

  it('returns no items when the completion result is null', async () => {
    ;(global as any).window = { api: { autocompleteComplete: vi.fn().mockResolvedValue(null) } }

    const promise = provideInlineCompletion(fakeModel(), { lineNumber: 1, column: 1 }, fakeToken())
    await vi.advanceTimersByTimeAsync(700)

    expect(await promise).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/monacoAutocomplete.test.ts`
Expected: FAIL — cannot find module `../monacoAutocomplete`

- [ ] **Step 3: Implement**

```ts
// src/lib/monacoAutocomplete.ts
import { getCompletionContext, type PositionLike, type TextModelLike } from './autocompleteContext'
import { isAutocompleteEffectivelyEnabled } from './autocompleteEffectiveState'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteStatusStore } from '@/stores/autocompleteStatusStore'

const DEBOUNCE_MS = 700

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface CancellationTokenLike {
  isCancellationRequested: boolean
}

export interface InlineCompletionItem {
  insertText: string
  range: {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }
}

type LanguageAwareModel = TextModelLike & { getLanguageId(): string }

export async function provideInlineCompletion(
  model: LanguageAwareModel,
  position: PositionLike,
  token: CancellationTokenLike
): Promise<InlineCompletionItem[]> {
  if (!isAutocompleteEffectivelyEnabled()) return []

  await sleep(DEBOUNCE_MS)
  if (token.isCancellationRequested) return []

  const { prefix, suffix } = getCompletionContext(model, position)
  const language = model.getLanguageId()
  const selectedModel = useAutocompleteSettingsStore.getState().model

  useAutocompleteStatusStore.getState().setBusy(true)
  let text: string | null
  try {
    text = await window.api.autocompleteComplete(prefix, suffix, language, selectedModel)
  } finally {
    useAutocompleteStatusStore.getState().setBusy(false)
  }

  if (!text || token.isCancellationRequested) return []

  return [{
    insertText: text,
    range: {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    },
  }]
}

let registered = false

export function registerAutocompleteProvider(monaco: typeof import('monaco-editor')): void {
  if (registered) return
  registered = true

  monaco.languages.registerInlineCompletionsProvider('*', {
    provideInlineCompletions: async (model, position, _context, token) => ({
      items: await provideInlineCompletion(model as unknown as LanguageAwareModel, position, token),
    }),
    freeInlineCompletions: () => {},
  })
}
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx vitest run src/lib/__tests__/monacoAutocomplete.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Wire the provider into Editor.tsx**

Add the import near the other `@/lib`/store imports at the top of `src/components/Editor/Editor.tsx`:

```ts
import { registerAutocompleteProvider } from '@/lib/monacoAutocomplete'
```

In the writable `MonacoEditor`'s `options` object, find:
```tsx
              options={{
                fontSize: editorFontSize,
                fontFamily: font,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                padding: { top: 8 },
                automaticLayout: true,
              }}
```

Replace with:
```tsx
              options={{
                fontSize: editorFontSize,
                fontFamily: font,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                padding: { top: 8 },
                automaticLayout: true,
                inlineSuggest: { enabled: true },
              }}
```

In the same `MonacoEditor`'s `onMount`, find:
```tsx
              onMount={(editor, monaco) => {
                editorRef.current = editor
                editor.onDidFocusEditorWidget(activatePane)
```

Replace with:
```tsx
              onMount={(editor, monaco) => {
                editorRef.current = editor
                registerAutocompleteProvider(monaco)
                editor.onDidFocusEditorWidget(activatePane)
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: no new errors introduced.

- [ ] **Step 7: Commit**

```bash
git add src/lib/monacoAutocomplete.ts src/lib/__tests__/monacoAutocomplete.test.ts src/components/Editor/Editor.tsx
git commit -m "Register a debounced Monaco inline-completions provider"
```

---

### Task 8: Status bar icon (on/working/off) with pause popup

**Files:**
- Modify: `src/components/ActivityBar/ActivityBar.tsx` (add the icon component, alongside `GitIcon`/`TodoIcon`)
- Modify: `src/components/StatusBar/StatusBar.tsx`
- Test: `src/components/__tests__/AutocompleteIcon.test.tsx`
- Test: `src/components/StatusBar/__tests__/StatusBar.test.tsx`

**Interfaces:**
- Consumes: `useAutocompleteSettingsStore`, `useAutocompleteSessionStore`, `useAutocompleteStatusStore` (Task 1).
- Produces: `AutocompleteIcon({ crossedOut, className }): JSX.Element`, exported from `ActivityBar.tsx`.

- [ ] **Step 1: Write the failing icon test**

```tsx
// src/components/__tests__/AutocompleteIcon.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AutocompleteIcon } from '@/components/ActivityBar/ActivityBar'

describe('AutocompleteIcon', () => {
  it('renders an svg', () => {
    const { container } = render(<AutocompleteIcon crossedOut={false} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a slash path when crossedOut is true', () => {
    const { container } = render(<AutocompleteIcon crossedOut={true} />)
    expect(container.querySelectorAll('svg path').length).toBe(3)
  })

  it('omits the slash path when crossedOut is false', () => {
    const { container } = render(<AutocompleteIcon crossedOut={false} />)
    expect(container.querySelectorAll('svg path').length).toBe(2)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/__tests__/AutocompleteIcon.test.tsx`
Expected: FAIL — `AutocompleteIcon` is not exported from `ActivityBar.tsx`

- [ ] **Step 3: Add the icon component**

In `src/components/ActivityBar/ActivityBar.tsx`, add this export near `GitIcon`/`TodoIcon`:

```tsx
export function AutocompleteIcon({ crossedOut, className }: { crossedOut: boolean; className?: string }) {
  return (
    <svg className={className} width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 4h2v16h-2z" fill="currentColor" />
      <path d="M15 9c2 0 3.5 1.3 3.5 3s-1.5 3-3.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1 3" />
      {crossedOut && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  )
}
```

- [ ] **Step 4: Run the icon test again to verify it passes**

Run: `npx vitest run src/components/__tests__/AutocompleteIcon.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing StatusBar tests**

```tsx
// src/components/StatusBar/__tests__/StatusBar.test.tsx
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { StatusBar } from '../StatusBar'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteSessionStore } from '@/stores/autocompleteSessionStore'
import { useAutocompleteStatusStore } from '@/stores/autocompleteStatusStore'

beforeEach(() => {
  ;(global as any).window.api = {
    gitBranch: async () => null,
    gitAheadBehind: async () => null,
  }
})

afterEach(() => {
  cleanup()
  useAutocompleteSettingsStore.setState({ enabled: true, model: 'claude-haiku-4-5-20251001' })
  useAutocompleteSessionStore.setState({ paused: false })
  useAutocompleteStatusStore.setState({ busy: false })
})

describe('StatusBar autocomplete icon', () => {
  it('shows the crossed-out icon when disabled in settings', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    render(<StatusBar />)
    expect(screen.getByRole('button', { name: 'Autocomplete off' })).toBeTruthy()
  })

  it('shows the active icon when enabled and not paused', () => {
    render(<StatusBar />)
    expect(screen.getByRole('button', { name: 'Autocomplete on' })).toBeTruthy()
  })

  it('opens a pause popup on click when enabled', () => {
    render(<StatusBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Autocomplete on' }))
    expect(screen.getByText('Pause for this session')).toBeTruthy()
  })

  it('pausing flips the session store and updates the popup label', () => {
    render(<StatusBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Autocomplete on' }))
    fireEvent.click(screen.getByText('Pause for this session'))

    expect(useAutocompleteSessionStore.getState().paused).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Autocomplete off' }))
    expect(screen.getByText('Resume')).toBeTruthy()
  })

  it('shows an informational message instead of a toggle when disabled in settings', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    render(<StatusBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Autocomplete off' }))

    expect(screen.getByText('Autocomplete is off in Settings')).toBeTruthy()
    expect(screen.queryByText('Pause for this session')).toBeNull()
    expect(screen.queryByText('Resume')).toBeNull()
  })

  it('opens the same popup on right-click', () => {
    render(<StatusBar />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Autocomplete on' }))
    expect(screen.getByText('Pause for this session')).toBeTruthy()
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/components/StatusBar/__tests__/StatusBar.test.tsx`
Expected: FAIL — no element with accessible name "Autocomplete on"/"Autocomplete off" exists yet.

- [ ] **Step 7: Implement in StatusBar.tsx**

Add imports at the top of `src/components/StatusBar/StatusBar.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useFileStore } from '@/stores/fileStore'
import { useGitStore } from '@/stores/gitStore'
import { GitIcon, AutocompleteIcon } from '@/components/ActivityBar/ActivityBar'
import { GitActionsMenu } from '@/components/Git/GitActionsMenu'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteSessionStore } from '@/stores/autocompleteSessionStore'
import { useAutocompleteStatusStore } from '@/stores/autocompleteStatusStore'
```

(This replaces the existing narrower import list at the top of the file — keep every existing import, just add `AutocompleteIcon` to the `ActivityBar` import and the three new store imports.)

Inside the `StatusBar` component function, add alongside the existing `menuOpen`/`gitMenuOpen` state:

```tsx
  const autocompleteEnabled = useAutocompleteSettingsStore((s) => s.enabled)
  const autocompletePaused = useAutocompleteSessionStore((s) => s.paused)
  const togglePaused = useAutocompleteSessionStore((s) => s.togglePaused)
  const autocompleteBusy = useAutocompleteStatusStore((s) => s.busy)
  const autocompleteActive = autocompleteEnabled && !autocompletePaused
  const [autocompleteMenuOpen, setAutocompleteMenuOpen] = useState(false)
```

Add a matching outside-click effect alongside the existing `menuOpen`/`gitMenuOpen` effects:

```tsx
  useEffect(() => {
    if (!autocompleteMenuOpen) return
    const close = () => setAutocompleteMenuOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [autocompleteMenuOpen])
```

In the JSX, find the right-hand controls group:
```tsx
      <div className="flex items-center gap-1 text-fg-muted text-xs">
        <button
          type="button"
          onClick={decrease}
```

Replace with:
```tsx
      <div className="flex items-center gap-1 text-fg-muted text-xs">
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setAutocompleteMenuOpen((o) => !o) }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setAutocompleteMenuOpen((o) => !o) }}
            className={[
              'w-5 h-5 flex items-center justify-center transition-colors',
              autocompleteActive ? 'text-fg-muted hover:text-fg' : 'text-fg-subtle hover:text-fg-muted',
            ].join(' ')}
            aria-label={autocompleteActive ? 'Autocomplete on' : 'Autocomplete off'}
            title={autocompleteActive ? (autocompleteBusy ? 'Autocomplete: working…' : 'Autocomplete: on') : 'Autocomplete: off'}
          >
            <AutocompleteIcon
              crossedOut={!autocompleteActive}
              className={autocompleteActive && autocompleteBusy ? 'animate-pulse' : ''}
            />
          </button>
          {autocompleteMenuOpen && (
            <div className="absolute bottom-full right-0 mb-1 w-56 rounded border border-border bg-popover shadow-lg shadow-black/40 py-1 z-50">
              {!autocompleteEnabled ? (
                <div className="px-3 py-1.5 text-xs text-fg-subtle">Autocomplete is off in Settings</div>
              ) : (
                <button
                  type="button"
                  onClick={() => { togglePaused(); setAutocompleteMenuOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-fg hover:bg-white/5 transition-colors"
                >
                  {autocompletePaused ? 'Resume' : 'Pause for this session'}
                </button>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={decrease}
```

- [ ] **Step 8: Run the StatusBar tests again to verify they pass**

Run: `npx vitest run src/components/StatusBar/__tests__/StatusBar.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 9: Run the full test suite to check for regressions**

Run: `npm test`
Expected: same pass/fail counts as before this task, plus the new tests passing.

- [ ] **Step 10: Commit**

```bash
git add src/components/ActivityBar/ActivityBar.tsx src/components/StatusBar/StatusBar.tsx src/components/__tests__/AutocompleteIcon.test.tsx src/components/StatusBar/__tests__/StatusBar.test.tsx
git commit -m "Add 3-state autocomplete status bar icon with session-pause popup"
```

---

### Task 9: EditorSettingsPage — Autocomplete section

**Files:**
- Modify: `src/components/Settings/EditorSettingsPage.tsx`
- Test: `src/components/Settings/__tests__/EditorSettingsPage.test.tsx`

**Interfaces:**
- Consumes: `useAutocompleteSettingsStore`, `AUTOCOMPLETE_MODELS` (Task 1); `Toggle` (existing, `@/components/ui/Toggle`).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/Settings/__tests__/EditorSettingsPage.test.tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { EditorSettingsPage } from '../EditorSettingsPage'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'

afterEach(() => {
  cleanup()
  useAutocompleteSettingsStore.setState({ enabled: true, model: 'claude-haiku-4-5-20251001' })
  useEditorSettingsStore.setState({ autoSaveEnabled: false })
})

describe('EditorSettingsPage autocomplete section', () => {
  it('reflects the current enabled state', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    render(<EditorSettingsPage />)
    expect(screen.getByRole('switch', { name: 'Inline Autocomplete' })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles autocomplete on click', () => {
    render(<EditorSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Inline Autocomplete' }))
    expect(useAutocompleteSettingsStore.getState().enabled).toBe(false)
  })

  it('reflects the current model selection', () => {
    useAutocompleteSettingsStore.setState({ model: 'claude-opus-5' })
    render(<EditorSettingsPage />)
    expect((screen.getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-opus-5')
  })

  it('updates the model when changed', () => {
    render(<EditorSettingsPage />)
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'claude-sonnet-5' } })
    expect(useAutocompleteSettingsStore.getState().model).toBe('claude-sonnet-5')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/Settings/__tests__/EditorSettingsPage.test.tsx`
Expected: FAIL — no switch/select with those accessible names exists yet.

- [ ] **Step 3: Implement**

Replace the full contents of `src/components/Settings/EditorSettingsPage.tsx` with:

```tsx
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'
import { useAutocompleteSettingsStore, AUTOCOMPLETE_MODELS } from '@/stores/autocompleteSettingsStore'
import { Toggle } from '@/components/ui/Toggle'

export function EditorSettingsPage() {
  const autoSaveEnabled = useEditorSettingsStore((s) => s.autoSaveEnabled)
  const setAutoSaveEnabled = useEditorSettingsStore((s) => s.setAutoSaveEnabled)
  const autocompleteEnabled = useAutocompleteSettingsStore((s) => s.enabled)
  const setAutocompleteEnabled = useAutocompleteSettingsStore((s) => s.setEnabled)
  const autocompleteModel = useAutocompleteSettingsStore((s) => s.model)
  const setAutocompleteModel = useAutocompleteSettingsStore((s) => s.setModel)

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">Editor</h1>
      <p className="text-sm text-fg-muted mb-8">Editing behaviour for file tabs.</p>

      <div className="grid grid-cols-1 gap-6 max-w-lg">
        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            Save
          </h2>

          <Toggle
            label="Auto Save"
            description="Automatically save the active file shortly after changes."
            checked={autoSaveEnabled}
            onChange={setAutoSaveEnabled}
          />
        </section>

        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            Autocomplete
          </h2>

          <Toggle
            label="Inline Autocomplete"
            description="Show ghost-text code suggestions as you type, powered by your claude subscription."
            checked={autocompleteEnabled}
            onChange={setAutocompleteEnabled}
          />

          <div>
            <label htmlFor="autocomplete-model" className="text-xs text-fg-muted mb-1.5 block">Model</label>
            <div className="relative">
              <select
                id="autocomplete-model"
                value={autocompleteModel}
                onChange={(e) => setAutocompleteModel(e.target.value)}
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

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npx vitest run src/components/Settings/__tests__/EditorSettingsPage.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test`
Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: full suite green, no new typecheck errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings/EditorSettingsPage.tsx src/components/Settings/__tests__/EditorSettingsPage.test.tsx
git commit -m "Add Autocomplete section (enable toggle + model picker) to Editor settings"
```

---

## Manual verification (after all tasks)

Automated tests cover every pure function, store, and IPC contract in this
plan, but the actual ghost-text UX can only be verified by running the app
(per the spec's Testing section — Monaco's inline-completion rendering
isn't practically unit-testable):

1. `npm run dev`, open a project, open a code file.
2. Type a partial statement (e.g. `function add(a, b) {`) and pause — after
   ~700ms a grey ghost-text suggestion should appear; the status bar icon
   should briefly show its `animate-pulse` "working" treatment while the
   request is in flight.
3. Press Tab — the suggestion should be inserted. Press Esc on a fresh
   suggestion — it should dismiss without inserting.
4. Right-click (and left-click) the status bar icon — the popup should show
   "Pause for this session"; click it, confirm the icon switches to its
   crossed-out state and no further suggestions appear while typing.
5. Reopen the popup — it should now say "Resume"; click it and confirm
   suggestions resume.
6. Open Settings → Editor, toggle "Inline Autocomplete" off — confirm the
   status bar icon goes crossed-out and its popup now shows the
   informational "Autocomplete is off in Settings" message instead of a
   toggle. Turn it back on and change the model dropdown; confirm
   suggestions keep working.
7. Restart the app — confirm any session pause from step 4/5 has reset
   (the persisted Settings toggle from step 6 should still hold).
