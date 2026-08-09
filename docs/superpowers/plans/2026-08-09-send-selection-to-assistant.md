# Cmd+L: Send Highlighted Code to the Assistant Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cmd+L, pressed with code selected in the editor, injects that selection (formatted with file/line header) into whichever assistant panel is currently active (Claude/Codex terminal or Cosmos chat) without submitting it; pressed with no selection or focus outside any editor, it just opens and focuses the panel instead of toggling it closed.

**Architecture:** A shared `pendingInjection`/`focusToken` pair in `claudeStore` acts as the hand-off point. Two producers (a per-editor Monaco command for the has-selection/no-selection cases, and the existing global Electron menu accelerator for the focus-elsewhere fallback) write into it; two consumers (`Chat.tsx` for the `claude`/`codex` terminals, `CosmosChat.tsx` for `cosmos`) watch it and apply the injection in whatever way fits their UI, then clear it.

**Tech Stack:** React, Zustand, Monaco Editor, xterm.js, Electron, Vitest + Testing Library.

## Global Constraints

- No auto-submit: injected text must never include a trailing Enter/CR — the user always submits it themselves.
- Cmd+L must never close the panel once this ships, in any code path (selection, no selection, or global fallback).
- Terminal injection (`claude`/`codex`) must use the bracketed-paste escape sequence (`\x1b[200~...\x1b[201~`), not a raw write of text containing embedded newlines — see the design doc's discussion of why a raw write risks the CLI reading embedded newlines as separate submits.
- Follow the existing plain-string path style already used in `Editor/utils.ts`/`TabBar.tsx` (`path.split('/')`) — do not introduce Node's `path` module into renderer code.

Full design context: `docs/superpowers/specs/2026-08-09-send-selection-to-assistant-design.md`.

---

## Task 1: Formatting and bracketed-paste helpers

**Files:**
- Create: `src/lib/sendSelectionToAssistant.ts`
- Test: `src/lib/__tests__/sendSelectionToAssistant.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no store/UI dependency).
- Produces (used by Tasks 4, 5, 6):
  - `export interface SelectionForAssistant { relPath: string; startLine: number; endLine: number; language: string; code: string }`
  - `export function toRelativePath(absPath: string, projectRoot: string | null): string`
  - `export function formatSelectionForAssistant(input: SelectionForAssistant): string`
  - `export const BRACKETED_PASTE_START = '\x1b[200~'`
  - `export const BRACKETED_PASTE_END = '\x1b[201~'`
  - `export function wrapBracketedPaste(text: string): string`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/sendSelectionToAssistant.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  toRelativePath,
  formatSelectionForAssistant,
  wrapBracketedPaste,
  BRACKETED_PASTE_START,
  BRACKETED_PASTE_END,
} from '../sendSelectionToAssistant'

describe('toRelativePath', () => {
  it('strips the project root prefix', () => {
    expect(toRelativePath('/Users/thomas/project/src/foo.ts', '/Users/thomas/project')).toBe('src/foo.ts')
  })

  it('handles a project root with a trailing slash', () => {
    expect(toRelativePath('/Users/thomas/project/src/foo.ts', '/Users/thomas/project/')).toBe('src/foo.ts')
  })

  it('falls back to the absolute path when it is outside the project root', () => {
    expect(toRelativePath('/etc/hosts', '/Users/thomas/project')).toBe('/etc/hosts')
  })

  it('falls back to the absolute path when there is no project root', () => {
    expect(toRelativePath('/Users/thomas/project/src/foo.ts', null)).toBe('/Users/thomas/project/src/foo.ts')
  })
})

describe('formatSelectionForAssistant', () => {
  it('formats a multi-line selection with a line range header', () => {
    const text = formatSelectionForAssistant({
      relPath: 'src/foo.ts',
      startLine: 10,
      endLine: 25,
      language: 'ts',
      code: 'function handleClick() {\n  doThing()\n}',
    })
    expect(text).toBe('In src/foo.ts (lines 10-25):\n```ts\nfunction handleClick() {\n  doThing()\n}\n```')
  })

  it('formats a single-line selection with a singular line header', () => {
    const text = formatSelectionForAssistant({
      relPath: 'src/foo.ts',
      startLine: 12,
      endLine: 12,
      language: 'ts',
      code: 'doThing()',
    })
    expect(text).toBe('In src/foo.ts (line 12):\n```ts\ndoThing()\n```')
  })
})

describe('wrapBracketedPaste', () => {
  it('wraps text in the bracketed-paste start/end escape sequences', () => {
    expect(wrapBracketedPaste('hello')).toBe(`${BRACKETED_PASTE_START}hello${BRACKETED_PASTE_END}`)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/sendSelectionToAssistant.test.ts`
Expected: FAIL — `Failed to load url ../sendSelectionToAssistant` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/sendSelectionToAssistant.ts`:

```ts
export interface SelectionForAssistant {
  relPath: string
  startLine: number
  endLine: number
  language: string
  code: string
}

export function toRelativePath(absPath: string, projectRoot: string | null): string {
  if (!projectRoot) return absPath
  const prefix = projectRoot.endsWith('/') ? projectRoot : `${projectRoot}/`
  return absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath
}

export function formatSelectionForAssistant({ relPath, startLine, endLine, language, code }: SelectionForAssistant): string {
  const lineLabel = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`
  return `In ${relPath} (${lineLabel}):\n\`\`\`${language}\n${code}\n\`\`\``
}

// The bracketed-paste protocol every real terminal uses to deliver a
// multi-line paste to a foreground CLI in one shot, so embedded newlines
// aren't read as separate keystrokes/submits by the CLI's line editor.
export const BRACKETED_PASTE_START = '\x1b[200~'
export const BRACKETED_PASTE_END = '\x1b[201~'

export function wrapBracketedPaste(text: string): string {
  return `${BRACKETED_PASTE_START}${text}${BRACKETED_PASTE_END}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/sendSelectionToAssistant.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/sendSelectionToAssistant.ts src/lib/__tests__/sendSelectionToAssistant.test.ts
git commit -m "Add selection formatting and bracketed-paste helpers for Cmd+L"
```

---

## Task 2: claudeStore hand-off state

**Files:**
- Modify: `src/stores/claudeStore.ts`
- Test: `src/stores/__tests__/claudeStore.test.ts` (new file)

**Interfaces:**
- Consumes: nothing new (existing `ClaudeState` shape from `src/stores/claudeStore.ts`).
- Produces (used by Tasks 3, 4, 5, 6):
  - `pendingInjection: string | null` (new field on `ClaudeState`) — `focusToken` (below) is the change signal consumers key their effects off; `pendingInjection` is just the payload, so it carries no token of its own.
  - `focusToken: number` (new field on `ClaudeState`)
  - `sendSelection: (text: string) => void` — sets `chatVisible: true`, `pendingInjection: text`, and bumps `focusToken`.
  - `focusChat: () => void` — sets `chatVisible: true` and bumps `focusToken`, leaves `pendingInjection` untouched.
  - `consumeInjection: () => void` — sets `pendingInjection: null`.
  - Existing `toggleChatVisible` and `chatVisible` are unchanged (the panel's own show/hide button keeps using `toggleChatVisible`).

- [ ] **Step 1: Write the failing tests**

Create `src/stores/__tests__/claudeStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  return { store }
})

import { useClaudeStore } from '../claudeStore'

describe('claudeStore selection hand-off', () => {
  beforeEach(() => {
    useClaudeStore.setState({ chatVisible: true, pendingInjection: null, focusToken: 0 })
  })

  it('sendSelection opens the panel, sets pendingInjection, and bumps focusToken', () => {
    useClaudeStore.setState({ chatVisible: false })
    useClaudeStore.getState().sendSelection('In src/foo.ts (line 1):\n```ts\ncode\n```')

    const state = useClaudeStore.getState()
    expect(state.chatVisible).toBe(true)
    expect(state.pendingInjection).toBe('In src/foo.ts (line 1):\n```ts\ncode\n```')
    expect(state.focusToken).toBe(1)
  })

  it('focusChat opens the panel and bumps focusToken without setting pendingInjection', () => {
    useClaudeStore.setState({ chatVisible: false })
    useClaudeStore.getState().focusChat()

    const state = useClaudeStore.getState()
    expect(state.chatVisible).toBe(true)
    expect(state.pendingInjection).toBeNull()
    expect(state.focusToken).toBe(1)
  })

  it('focusChat leaves an already-open panel open (never closes it)', () => {
    useClaudeStore.getState().focusChat()
    expect(useClaudeStore.getState().chatVisible).toBe(true)
  })

  it('consumeInjection clears pendingInjection', () => {
    useClaudeStore.getState().sendSelection('text')
    useClaudeStore.getState().consumeInjection()
    expect(useClaudeStore.getState().pendingInjection).toBeNull()
  })

  it('bumps focusToken further on each subsequent call', () => {
    useClaudeStore.getState().sendSelection('first')
    useClaudeStore.getState().sendSelection('second')

    const state = useClaudeStore.getState()
    expect(state.focusToken).toBe(2)
    expect(state.pendingInjection).toBe('second')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/stores/__tests__/claudeStore.test.ts`
Expected: FAIL — `sendSelection is not a function` (and similar for `focusChat`/`consumeInjection`/missing fields).

- [ ] **Step 3: Implement the store changes**

In `src/stores/claudeStore.ts`, add to the `ClaudeState` interface (after `chatVisible: boolean`):

```ts
  chatVisible: boolean
  pendingInjection: string | null
  focusToken: number
```

and add three new method signatures to the interface (after `toggleChatVisible: () => void`):

```ts
  toggleChatVisible: () => void
  sendSelection: (text: string) => void
  focusChat: () => void
  consumeInjection: () => void
```

In the store body, add initial values (after `chatVisible: true,`):

```ts
  chatVisible: true,
  pendingInjection: null,
  focusToken: 0,
```

and add the three actions (after the existing `toggleChatVisible: () => set((s) => ({ chatVisible: !s.chatVisible })),` line):

```ts
  toggleChatVisible: () => set((s) => ({ chatVisible: !s.chatVisible })),

  sendSelection: (text) => {
    set((s) => ({ chatVisible: true, pendingInjection: text, focusToken: s.focusToken + 1 }))
  },

  focusChat: () => {
    set((s) => ({ chatVisible: true, focusToken: s.focusToken + 1 }))
  },

  consumeInjection: () => set({ pendingInjection: null }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/stores/__tests__/claudeStore.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/stores/claudeStore.ts src/stores/__tests__/claudeStore.test.ts
git commit -m "Add pendingInjection/focusToken hand-off to claudeStore for Cmd+L"
```

---

## Task 3: Cosmos draft input + injection consumption

**Files:**
- Modify: `src/stores/cosmosStore.ts`
- Modify: `src/components/Chat/CosmosChat.tsx`
- Test: `src/stores/__tests__/cosmosStore.test.ts` (append to existing file)
- Test: `src/components/Chat/__tests__/CosmosChat.test.tsx` (append to existing file)

**Interfaces:**
- Consumes: `useClaudeStore` fields/actions from Task 2 (`focusToken`, `pendingInjection`, `consumeInjection`).
- Produces: `draftInput: string`, `setDraftInput: (text: string) => void`, `appendDraftInput: (text: string) => void` on `useCosmosStore` — `CosmosChat.tsx`'s local `input` state is removed; its input textarea is now store-backed for anything that needs to reach it externally.

- [ ] **Step 1: Write the failing store tests**

Read the current end of `src/stores/__tests__/cosmosStore.test.ts` first (`tail -20 src/stores/__tests__/cosmosStore.test.ts`) to see the closing `})` of the `describe` block, then append this new `describe` block just before that final closing `})` of the file (same indentation level as the existing `it(...)` blocks, i.e. as a sibling `describe` inside the outer `describe('cosmosStore', ...)`):

```ts
  describe('draft input', () => {
    beforeEach(() => {
      useCosmosStore.setState({ draftInput: '' })
    })

    it('setDraftInput replaces the draft', () => {
      useCosmosStore.getState().setDraftInput('hello')
      expect(useCosmosStore.getState().draftInput).toBe('hello')
    })

    it('appendDraftInput appends onto existing text with a newline separator', () => {
      useCosmosStore.getState().setDraftInput('question?')
      useCosmosStore.getState().appendDraftInput('```ts\ncode\n```')
      expect(useCosmosStore.getState().draftInput).toBe('question?\n```ts\ncode\n```')
    })

    it('appendDraftInput on an empty draft does not add a leading newline', () => {
      useCosmosStore.getState().appendDraftInput('```ts\ncode\n```')
      expect(useCosmosStore.getState().draftInput).toBe('```ts\ncode\n```')
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/stores/__tests__/cosmosStore.test.ts`
Expected: FAIL — `setDraftInput is not a function`

- [ ] **Step 3: Implement the cosmosStore changes**

In `src/stores/cosmosStore.ts`, add to the `CosmosStore` interface (after `streaming: boolean`):

```ts
  streaming: boolean
  draftInput: string
```

and add two new method signatures (after `initEventListener: () => () => void`):

```ts
  initEventListener: () => () => void
  setDraftInput: (text: string) => void
  appendDraftInput: (text: string) => void
```

In the store body, add the initial value (after `streaming: false,`):

```ts
  streaming: false,
  draftInput: '',
```

and add the two actions (after the `initEventListener: () => {...},` block, before the closing `}))`):

```ts
  setDraftInput: (text) => set({ draftInput: text }),
  appendDraftInput: (text) =>
    set((s) => ({ draftInput: s.draftInput ? `${s.draftInput}\n${text}` : text })),
```

- [ ] **Step 4: Run store tests to verify they pass**

Run: `npx vitest run src/stores/__tests__/cosmosStore.test.ts`
Expected: PASS (all tests including the 3 new ones)

- [ ] **Step 5: Write the failing CosmosChat tests**

In `src/components/Chat/__tests__/CosmosChat.test.tsx`, add the import (with the other imports at the top):

```ts
import { useClaudeStore } from '@/stores/claudeStore'
```

Update the existing `beforeEach` to also reset the claudeStore fields this component now reads, and reset `draftInput`:

```ts
beforeEach(() => {
  ;(global as any).window.api = {
    ...(global as any).window.api,
    onCosmosEvent: vi.fn(() => () => {}),
    cosmosSend: vi.fn(),
    cosmosApprove: vi.fn(),
    cosmosReject: vi.fn(),
    cosmosCancel: vi.fn(),
  }
  useCosmosStore.setState({ messages: [], previousMessages: [], streaming: false, agentMode: false, draftInput: '' })
  useClaudeStore.setState({ pendingInjection: null, focusToken: 0 })
})
```

Add these two tests at the end of the `describe('CosmosChat', ...)` block:

```ts
  it('injects a pendingInjection into the draft input and focuses the textarea', () => {
    useCosmosStore.setState({ draftInput: 'existing question' })
    useClaudeStore.setState({
      pendingInjection: 'In src/foo.ts (line 1):\n```ts\ncode\n```',
      focusToken: 1,
    })

    render(<CosmosChat cwd="/project" />)

    const textarea = screen.getByPlaceholderText('Message Cosmos…') as HTMLTextAreaElement
    expect(textarea.value).toBe('existing question\nIn src/foo.ts (line 1):\n```ts\ncode\n```')
    expect(useClaudeStore.getState().pendingInjection).toBeNull()
    expect(document.activeElement).toBe(textarea)
  })

  it('does not inject anything when focusToken is still at its initial value', () => {
    render(<CosmosChat cwd="/project" />)

    const textarea = screen.getByPlaceholderText('Message Cosmos…') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
  })
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/components/Chat/__tests__/CosmosChat.test.tsx`
Expected: FAIL — textarea value is `''` instead of the expected injected text (CosmosChat doesn't read `draftInput`/`pendingInjection` yet).

- [ ] **Step 7: Implement the CosmosChat changes**

In `src/components/Chat/CosmosChat.tsx`, add the import (with the other imports at the top):

```ts
import { useClaudeStore } from '@/stores/claudeStore'
```

Replace:

```ts
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
```

with:

```ts
  const input = useCosmosStore((s) => s.draftInput)
  const setInput = useCosmosStore((s) => s.setDraftInput)
  const appendDraftInput = useCosmosStore((s) => s.appendDraftInput)
  const focusToken = useClaudeStore((s) => s.focusToken)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const seenFocusTokenRef = useRef(focusToken)
```

Add a new effect, right after the existing scroll-into-view effect (`useEffect(() => { bottomRef.current?.scrollIntoView?.(...) }, [messages])`):

```ts
  useEffect(() => {
    if (focusToken === seenFocusTokenRef.current) return
    seenFocusTokenRef.current = focusToken
    const injection = useClaudeStore.getState().pendingInjection
    if (injection) {
      appendDraftInput(injection)
      useClaudeStore.getState().consumeInjection()
    }
    textareaRef.current?.focus()
  }, [focusToken, appendDraftInput])
```

`focusToken` lives in the module-level `claudeStore`, so it does not reset when `CosmosChat` unmounts (e.g. switching to the Claude/Codex tab and back). A bare `focusToken === 0` check would only catch the app's very first mount ever — after that, any later remount of `CosmosChat` (from switching assistants and switching back) would see a stale nonzero `focusToken` and immediately steal focus with no new Cmd+L press. `seenFocusTokenRef` is initialized once per mount (`useRef`'s initial-value argument is only used on that instance's first render), so the effect only reacts to a token that changes *after this mount*, not to whatever value was already sitting there when it mounted.

Add `ref={textareaRef}` to the `<textarea>` element (alongside its existing `value`/`onChange`/`onKeyDown` props).

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/components/Chat/__tests__/CosmosChat.test.tsx`
Expected: PASS (all tests including the 2 new ones)

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add src/stores/cosmosStore.ts src/stores/__tests__/cosmosStore.test.ts src/components/Chat/CosmosChat.tsx src/components/Chat/__tests__/CosmosChat.test.tsx
git commit -m "Wire Cosmos chat input to accept external Cmd+L injections"
```

---

## Task 4: Claude/Codex terminal injection consumption

**Files:**
- Modify: `src/components/Chat/Chat.tsx`
- Test: `src/components/Chat/__tests__/Chat.test.tsx` (append to existing file)

**Interfaces:**
- Consumes: `wrapBracketedPaste` from Task 1 (`src/lib/sendSelectionToAssistant.ts`); `focusToken`/`pendingInjection`/`consumeInjection` from Task 2 (`useClaudeStore`).
- Produces: nothing new for later tasks — this is a leaf consumer.

- [ ] **Step 1: Write the failing tests**

In `src/components/Chat/__tests__/Chat.test.tsx`, change the existing `@testing-library/react` import line to also pull in `act`:

```ts
import { render, cleanup, waitFor, act } from '@testing-library/react'
```

and add a new import (with the other imports at the top):

```ts
import { BRACKETED_PASTE_START, BRACKETED_PASTE_END } from '@/lib/sendSelectionToAssistant'
```

Update the existing `beforeEach`'s `useClaudeStore.setState(...)` call to also reset the new fields:

```ts
  useClaudeStore.setState({ assistant: 'claude', restartToken: 0, pendingInjection: null, focusToken: 0 })
```

Add these two tests at the end of the `describe('Chat (claude terminal)', ...)` block:

```ts
  it('writes a bracketed-paste-wrapped injection to the active assistant and focuses the terminal', async () => {
    const { container } = render(<Chat />)
    await waitFor(() => {
      if (!container.querySelector('.xterm-helper-textarea')) throw new Error('xterm helper textarea not mounted yet')
    })

    act(() => {
      useClaudeStore.getState().sendSelection('In src/foo.ts (line 1):\n```ts\ncode\n```')
    })

    const writeMock = (window.api as any).assistantWrite as ReturnType<typeof vi.fn>
    expect(writeMock).toHaveBeenCalledWith(
      'claude',
      `${BRACKETED_PASTE_START}In src/foo.ts (line 1):\n\`\`\`ts\ncode\n\`\`\`${BRACKETED_PASTE_END}`
    )
    expect(useClaudeStore.getState().pendingInjection).toBeNull()
  })

  it('does not write anything for a bare focusChat() with no pending injection', async () => {
    const { container } = render(<Chat />)
    await waitFor(() => {
      if (!container.querySelector('.xterm-helper-textarea')) throw new Error('xterm helper textarea not mounted yet')
    })

    act(() => {
      useClaudeStore.getState().focusChat()
    })

    const writeMock = (window.api as any).assistantWrite as ReturnType<typeof vi.fn>
    expect(writeMock).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Chat/__tests__/Chat.test.tsx`
Expected: FAIL — `assistantWrite` was never called with the expected bracketed-paste text (Chat.tsx doesn't watch `pendingInjection` yet).

- [ ] **Step 3: Implement the Chat.tsx changes**

Add the import (with the other imports at the top of `src/components/Chat/Chat.tsx`):

```ts
import { wrapBracketedPaste } from '@/lib/sendSelectionToAssistant'
```

Add `focusToken` to the set of subscribed store values, right after the existing `const assistant = useClaudeStore((s) => s.assistant)` line, and add a ref to track the last `focusToken` this component instance has already handled (right after the existing `const isFirstRestart = useRef(true)` line):

```ts
  const assistant = useClaudeStore((s) => s.assistant)
  const focusToken = useClaudeStore((s) => s.focusToken)
```

```ts
  const isFirstRestart = useRef(true)
  const seenFocusTokenRef = useRef(focusToken)
```

Add a new effect immediately after the closing `}, [projectRoot, assistant])` of the main terminal-creation effect (the one starting `useEffect(() => { if (!projectRoot || !containerRef.current || assistant === 'cosmos') return ...`):

```ts
  useEffect(() => {
    if (assistant === 'cosmos') return
    const terminal = terminalsRef.current[assistant]
    if (!terminal) return

    const injection = useClaudeStore.getState().pendingInjection
    if (injection) {
      window.api.assistantWrite(assistant, wrapBracketedPaste(injection))
      useClaudeStore.getState().consumeInjection()
      seenFocusTokenRef.current = focusToken
      terminal.xterm.focus()
      return
    }
    if (focusToken === seenFocusTokenRef.current) return
    seenFocusTokenRef.current = focusToken
    terminal.xterm.focus()
  }, [focusToken, assistant])
```

Same reasoning as Task 3's `CosmosChat` effect, and the same branch shape its fix round landed on: `focusToken` lives in the module-level `claudeStore` and doesn't reset on remount, so comparing against a ref seeded at mount (rather than the literal `0`) is what actually means "a new Cmd+L happened since this component started watching." A pending injection is always delivered regardless of that check — an unconsumed injection is never a stale leftover, since `pendingInjection` is only ever non-null immediately after `sendSelection` sets it alongside a fresh `focusToken` bump, and `consumeInjection` clears it right after use — so gating delivery on "did the token change since I mounted" would (as Task 3's fix round discovered) incorrectly drop a genuine injection that arrived at/before this effect's owning component mounted. The token-changed check applies only to the no-injection, focus-only path.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Chat/__tests__/Chat.test.tsx`
Expected: PASS (all 4 tests: the 2 pre-existing Shift+Enter tests plus the 2 new ones)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/Chat/Chat.tsx src/components/Chat/__tests__/Chat.test.tsx
git commit -m "Write Cmd+L injections into the Claude/Codex terminal as a bracketed paste"
```

---

## Task 5: Cmd+L trigger in the editor (has-selection / no-selection)

**Files:**
- Modify: `src/components/Editor/Editor.tsx`

**Interfaces:**
- Consumes: `formatSelectionForAssistant`, `toRelativePath` from Task 1; `sendSelection`, `focusChat` from Task 2 (both via `useClaudeStore`, already imported in this file).
- Produces: nothing for later tasks.

There is no practical automated test for Monaco `editor.addCommand` wiring in this codebase today — none of the other bindings in this same `onMount` block (Cmd+S, Cmd+D, Cmd+F, Cmd+P, the pre-existing Cmd+L, etc.) have one either, since mounting a real Monaco editor in a test is prohibitively heavy for what it'd verify. This task is verified by the unit tests already covering `formatSelectionForAssistant`/`toRelativePath` (Task 1) and `sendSelection`/`focusChat` (Task 2), plus the manual check in Step 4 below.

- [ ] **Step 1: Add the import**

In `src/components/Editor/Editor.tsx`, add to the import block near the top (with the other `@/lib/...` and `@/stores/...` imports):

```ts
import { formatSelectionForAssistant, toRelativePath } from '@/lib/sendSelectionToAssistant'
```

- [ ] **Step 2: Replace the existing Cmd+L command**

Find this block inside the `onMount={(editor, monaco) => { ... }}` callback (currently around line 393):

```ts
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
                  useClaudeStore.getState().toggleChatVisible()
                })
```

Replace it with:

```ts
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
                  activatePane()
                  const selection = editor.getSelection()
                  const model = editor.getModel()
                  if (!selection || selection.isEmpty() || !model || !activeTab) {
                    useClaudeStore.getState().focusChat()
                    return
                  }
                  const text = formatSelectionForAssistant({
                    relPath: toRelativePath(activeTab.path, projectRoot),
                    startLine: selection.startLineNumber,
                    endLine: selection.endLineNumber,
                    language: model.getLanguageId(),
                    code: model.getValueInRange(selection),
                  })
                  useClaudeStore.getState().sendSelection(text)
                })
```

(`activatePane`, `activeTab`, and `projectRoot` are already in scope in this component — `activatePane` is used the same way by the neighboring Cmd+S/Cmd+D commands a few lines above; `activeTab` and `projectRoot` are declared near the top of the `EditorPane` function.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Manual verification**

Run: `npm run dev`

1. Open a file, select a few lines of code, press Cmd+L. Confirm the Claude panel opens (if closed) and the formatted `In <path> (lines X-Y):` + fenced code block appears in its input, without being submitted.
2. Switch the active assistant (top-right picker) to Codex, repeat step 1, confirm the same for the Codex terminal.
3. Switch to Cosmos, repeat step 1, confirm the text lands in Cosmos's input box.
4. Click into the editor with no selection (or just place the cursor), press Cmd+L. Confirm the panel opens/focuses with no text injected.
5. With the panel already open, press Cmd+L again with no selection. Confirm it does **not** close.

- [ ] **Step 5: Commit**

```bash
git add src/components/Editor/Editor.tsx
git commit -m "Wire Cmd+L in the editor to send the selection to the active assistant"
```

---

## Task 6: Global fallback (focus outside any editor) + menu label

**Files:**
- Modify: `src/App.tsx`
- Modify: `electron/main.ts`

**Interfaces:**
- Consumes: `focusChat` from Task 2 (via `useClaudeStore`, already imported in `App.tsx`).
- Produces: nothing for later tasks — this is the last task in the plan.

Same testing note as Task 5: neither `App.tsx`'s menu-IPC wiring nor `electron/main.ts`'s menu definitions have automated tests anywhere in this codebase; verified via typecheck plus the manual check below.

- [ ] **Step 1: Update the App.tsx handler**

In `src/App.tsx`, find this effect (currently around line 322):

```ts
  useEffect(() => {
    return window.api.onMenuToggleClaudeChat(() => {
      useClaudeStore.getState().toggleChatVisible()
    })
  }, [])
```

Replace the body with:

```ts
  useEffect(() => {
    return window.api.onMenuToggleClaudeChat(() => {
      useClaudeStore.getState().focusChat()
    })
  }, [])
```

- [ ] **Step 2: Rename the menu item label**

In `electron/main.ts`, find this menu item (currently around line 360):

```ts
        {
          label: 'Toggle Claude Chat',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:toggleClaudeChat')
          },
        },
```

Change only the label (leave the accelerator and IPC channel name as-is):

```ts
        {
          label: 'Show Claude Chat',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:toggleClaudeChat')
          },
        },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Manual verification**

Run: `npm run dev`

1. Click into the sidebar (or the terminal panel, or close all tabs so no editor is focused), press Cmd+L. Confirm the assistant panel opens/focuses and nothing is injected.
2. With the panel already open, press Cmd+L again from the sidebar. Confirm it stays open (does not close).
3. Open the app menu and confirm the item reads "Show Claude Chat".

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx electron/main.ts
git commit -m "Make the global Cmd+L fallback focus (not toggle) the Claude panel"
```

---

## Final Verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass except the one pre-existing, unrelated failure in `electron/__tests__/cosmos.test.ts` (present on `main` before this feature; see prior session notes).

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Re-run the manual verification checklist from Tasks 5 and 6 end-to-end in one pass, covering all three assistants.**
