# Cmd+L: Send Highlighted Code to the Assistant Panel

**Goal:** Bring a Cursor-style Cmd+L to Huginn — with code selected in the editor, Cmd+L drops it into whichever assistant panel (Claude, Codex, or Cosmos) is currently active, formatted with its file and line range, and focuses that panel's input without submitting anything. With no selection (or focus outside any editor), Cmd+L just opens and focuses the panel — replacing its current toggle-closed behavior.

## Background

Cmd+L is already bound today, but to a narrower behavior: it's an Electron
menu accelerator (`electron/main.ts`, `'CmdOrCtrl+L'`) that sends
`menu:toggleClaudeChat` over IPC, which `App.tsx` wires to
`useClaudeStore.getState().toggleChatVisible()` — a plain show/hide toggle
of the right-hand assistant panel, with no awareness of the editor at all.

The assistant panel itself is not one uniform UI. `Chat.tsx` hosts the
`claude` and `codex` assistants as raw `xterm.js` terminals wired to real
CLI subprocesses over a PTY (`window.api.assistantWrite(kind, data)` writes
bytes straight to the child's stdin) — there is no structured "chat input"
to manipulate, just a byte stream. `cosmos` is different: `CosmosChat.tsx`
is a custom React chat UI with its own local `input` state and its own
`sendMessage` plumbing through `cosmosStore`.

This asymmetry is why a literal port of Cursor's Cmd+L (which attaches a
structured "context chip" to its own chat data model) isn't possible here.
The design below treats "inject formatted code" as parallel adapters, one
per panel type, coordinated through a small shared piece of state in
`claudeStore`.

A closely related precedent already exists: the Shift+Enter fix
(`src/components/Chat/shiftEnterSequence.ts`) wrote a raw `ESC+CR` escape
sequence directly into the `claude` terminal's PTY input. This feature
follows the same "write real terminal escape sequences, not just plain
bytes" approach, using the **bracketed paste** sequence
(`\x1b[200~...\x1b[201~`) — the actual mechanism every real terminal uses
to deliver a multi-line paste to a foreground CLI without each embedded
newline being read as a separate keystroke/submit.

## Architecture

```
Cmd+L
  ├─ Focus is inside a Monaco editor (registerSendSelectionCommand, new file
  │  src/lib/sendSelectionToAssistant.ts, wired into EditorPane's onMount
  │  alongside the other editor.addCommand(...) bindings)
  │    → editor.addCommand(CtrlCmd | KeyL, () => {
  │        activatePane()
  │        const selection = editor.getSelection()
  │        if (!selection || selection.isEmpty()) {
  │          useClaudeStore.getState().focusChat()
  │          return
  │        }
  │        const model = editor.getModel()
  │        const code = model.getValueInRange(selection)
  │        const relPath = toRelativePath(activeTab.path, projectRoot)
  │        const language = model.getLanguageId()
  │        const text = formatSelectionForAssistant({
  │          relPath, startLine: selection.startLineNumber,
  │          endLine: selection.endLineNumber, language, code,
  │        })
  │        useClaudeStore.getState().sendSelection(text)
  │      })
  │    Monaco's own keybinding dispatch calls preventDefault() on a match,
  │    which suppresses the OS-level Electron accelerator below from also
  │    firing for the same keypress — the same dual-registration pattern
  │    already used for Cmd+F/Cmd+P/Cmd+D in this codebase.
  │
  └─ Focus is elsewhere (sidebar, terminal, no file open) — Monaco never
     saw the keypress, so the Electron menu accelerator fires instead
       (electron/main.ts 'CmdOrCtrl+L' → 'menu:toggleClaudeChat' IPC
        → App.tsx's existing onMenuToggleClaudeChat effect, changed from
        toggleChatVisible() to useClaudeStore.getState().focusChat())

claudeStore (new fields + actions)
  pendingInjection: { text: string; token: number } | null
  focusToken: number
  sendSelection(text) → { chatVisible: true, pendingInjection: { text, token: focusToken+1 }, focusToken: focusToken+1 }
  focusChat()          → { chatVisible: true, focusToken: focusToken+1 }   // no injection
  consumeInjection()   → { pendingInjection: null }

Chat.tsx (claude/codex terminals)
  useEffect on [pendingInjection, focusToken, assistant]:
    if assistant is 'claude' or 'codex':
      if pendingInjection: write '\x1b[200~' + text + '\x1b[201~' via
        window.api.assistantWrite(assistant, sequence); consumeInjection()
      xterm (for the active assistant's terminal instance) .focus()

CosmosChat.tsx (cosmos)
  input state moves from local useState into cosmosStore (draftInput,
  setDraftInput) so it's externally settable
  useEffect on [pendingInjection, focusToken, assistant]:
    if assistant is 'cosmos':
      if pendingInjection: setDraftInput(prev => prev + text); consumeInjection()
      textarea ref .focus()
```

### Formatting

A pure, unit-tested function in `src/lib/sendSelectionToAssistant.ts`:

```
formatSelectionForAssistant({ relPath, startLine, endLine, language, code }): string
```

produces:

```
In src/foo.ts (lines 10-25):
```ts
...selected text...
```
```

using `(line 10)` (singular, no range) when `startLine === endLine`. No
trailing Enter/CR is included anywhere in the injected text — the user
always presses Enter themselves to submit, per the "wait for Enter"
decision below.

`toRelativePath(absPath, projectRoot)` strips the project root prefix via
plain string operations (matching the existing basename-via-`split('/')`
style in `Editor/utils.ts`/`TabBar.tsx` rather than introducing Node's
`path` module into the renderer); if the path doesn't start with
`projectRoot` for some reason, it falls back to the path as-is.

### Decisions from clarifying questions

- **Scope:** works for whichever assistant is currently active — `claude`
  and `codex` share the terminal/bracketed-paste path; `cosmos` gets its
  own store-backed-input path.
- **Content:** always the file/line header + fenced code block, never bare
  code with no attribution.
- **Submission:** never auto-submitted; injected text sits in the input
  and the user adds their own instruction and presses Enter.
- **Toggle behavior:** Cmd+L no longer closes the panel under any
  circumstances (with or without a selection) — it only opens/focuses.
  Hiding the panel remains available via the existing panel toggle button
  in the UI (`App.tsx`, the button wired to
  `useClaudeStore.getState().toggleChatVisible()` stays as-is for that
  purpose). The Electron menu item itself (`electron/main.ts`, currently
  labeled "Toggle Claude Chat") is renamed to "Show Claude Chat" so its
  label matches its new open-only behavior.

### Edge cases

- **Empty selection while an editor is focused:** treated identically to
  "no selection" — `focusChat()`, no injection.
- **No project open / no active tab when the global fallback fires:**
  `focusChat()` still runs; there's nothing selection-related to inject
  since Monaco never had a chance to capture the keypress.
- **Bracketed paste support in Codex's CLI is unverified** — bracketed
  paste is a general terminal protocol, not something specific to Claude's
  CLI, so this should work for any readline-based CLI attached to the PTY,
  but this is a known assumption to confirm during manual testing rather
  than something the design can verify statically.

## Testing

- `formatSelectionForAssistant` / `toRelativePath`: pure unit tests
  (multi-line vs. single-line header, path prefix stripping, path outside
  project root fallback).
- `claudeStore`: unit tests for `sendSelection`/`focusChat`/
  `consumeInjection` state transitions, including that `chatVisible`
  becomes `true` and is never set back to `false` by any of these actions.
- `Chat.tsx`: integration test in the style of the existing
  `Chat.test.tsx` (real `xterm.js` mount, real DOM) asserting a
  `pendingInjection` update results in `assistantWrite` being called with
  the bracketed-paste-wrapped text for the active assistant, and not for
  the inactive one.
- `CosmosChat.tsx`: test that a `pendingInjection` update while
  `assistant === 'cosmos'` updates the rendered textarea's value.
- Manual verification: select code, Cmd+L, confirm the formatted block
  lands in each of the three panels without auto-submitting, and that
  Cmd+L with no selection focuses without closing an already-open panel.
