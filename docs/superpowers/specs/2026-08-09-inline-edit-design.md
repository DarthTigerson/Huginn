# Inline Edit (Cmd+K) Design

**Goal:** Bring Cursor-style Cmd+K inline code editing to Huginn — select code (or just place the cursor), describe the change, and get a streamed, previewable diff you can accept or reject, powered by the same `claude` subscription infrastructure as inline autocomplete.

## Background

Huginn already has a `claude`-CLI-based inline autocomplete feature
(`electron/autocomplete.ts`, `AutocompleteManager`) that spawns one-shot,
non-interactive `claude -p` processes for background ghost-text suggestions.
Inline Edit reuses that same authentication path (no API key, subscription
OAuth via a resolved absolute CLI path) and the same safety posture — never
`--bare`, never a shell-interpolated command, array-form `spawn` only — but
differs in three important ways:

1. **User-initiated, not background.** Cmd+K is an explicit action the user
   is actively waiting on, so unlike autocomplete's fully-silent failure
   mode, errors here are shown inline where the user can see and act on them.
2. **Streamed, not one-shot.** The response streams token-by-token via
   `claude -p --output-format stream-json --include-partial-messages`,
   forwarded to the renderer as it arrives, rather than autocomplete's
   single await-then-resolve call.
3. **Previewed, not silently applied.** The result is shown as an inline
   diff (old code struck through/red, new code green) that the user
   explicitly accepts or rejects — nothing touches the document until
   accepted.

## Architecture

```
Cmd+K (Editor.tsx onMount, writable MonacoEditor only)
  → prompt content widget appears near cursor/selection, focused
  → user types instruction, presses Enter
    → renderer captures: selection text (may be empty), capped prefix/suffix
      context (same caps as autocomplete: ~100 lines/4000 chars before,
      ~50 lines/2000 chars after), the instruction, language, model
    → prompt widget closes; a "generating" view zone appears after the
      selection (or at the cursor, if no selection)
    → window.api.inlineEditStart(...) — fire-and-forget, results arrive
      as events, not a return value
      → ipcMain.on('inlineEdit:start', ...) — InlineEditManager
        → kill any in-flight request for this window (same per-window
          supersede pattern as AutocompleteManager)
        → resolveClaudePath() (imported/reused from electron/autocomplete.ts)
        → spawn(claudePath, [...], { stdio: [...] }) with
          --output-format stream-json --include-partial-messages
        → parse newline-delimited JSON from stdout, extract text deltas
        → win.webContents.send('inlineEdit:event', { type: 'delta', text })
          for each chunk, then { type: 'done' } or { type: 'error', message }
  ← renderer accumulates deltas, updates the view zone's rendered text live
  ← on 'done': state becomes "reviewing"
    → Enter accepts: single executeEdits replacing the original range with
      the final text; decorations/view zone cleared
    → Esc rejects: decorations/view zone cleared, document untouched
  ← on 'error': view zone shows the error message inline with a dismiss
    action, document untouched
  ← Esc during generation: window.api.inlineEditCancel() kills the
    in-flight process and clears the UI immediately
```

### Monaco integration

- **Prompt widget:** a Monaco content widget (`editor.addContentWidget`)
  positioned relative to the selection/cursor, containing a plain text
  input. Opened by a new `editor.addCommand(monaco.KeyMod.CtrlCmd |
  monaco.KeyCode.KeyK, ...)` in the same `onMount` block that already
  registers the other editor commands and `registerAutocompleteProvider`.
- **Diff preview:** two Monaco primitives working together on the *same*
  editor instance (not a separate `DiffEditor`, which is a distinct
  read-only side-by-side view unsuited to an inline, in-place preview):
  - `editor.deltaDecorations(...)` marks the original selection range with
    a strikethrough/red-tinted class, without changing the document.
  - `editor.changeViewZones(...)` inserts a view zone immediately after
    that range, rendering the streaming/generated replacement text
    (green-tinted, syntax-highlighted via a nested read-only mini Monaco
    instance or a simple `<pre>` with the language's tokenizer — exact
    rendering approach is an implementation detail for the plan) that grows
    as deltas arrive.
  - On accept, a single `editor.executeEdits(...)` call replaces the range
    with the final accumulated text, then both the decoration and view zone
    are cleared in the same tick.
  - On reject/cancel/error-dismiss, only the decoration and view zone are
    cleared — no edit is ever applied.
- **No-selection (insert) mode:** the "old" side has nothing to
  strike through — only the view zone appears, at the cursor position.
  Accepting inserts the final text at that position via `executeEdits`.

## Prompt design

System prompt (fixed): instructs Claude it is a code-editing assistant.
Given the code immediately before/after the target region (`<prefix>`/
`<suffix>`, same caps as autocomplete), the code currently selected (if
any, `<selection>`), and the user's instruction, respond with ONLY the
replacement code for the selection (or, if `<selection>` is empty, ONLY the
code to insert at the cursor) — no explanations, no markdown fences, no
repeating unrelated surrounding code.

User-turn content: language ID, prefix, selection (possibly empty),
suffix, and the user's literal instruction text.

## IPC surface

Event-based, matching Cosmos's pattern (`electron/cosmos.ts`) rather than
autocomplete's promise-based one, since this is inherently a multi-event
stream over time:

- `ipcMain.on('inlineEdit:start', (event, payload) => ...)` — fire and
  forget; `payload` carries `{ prefix, suffix, selection, instruction,
  language, model }`.
- `ipcMain.on('inlineEdit:cancel', (event) => ...)` — kills the current
  window's in-flight request, if any.
- `win.webContents.send('inlineEdit:event', event)` where `event` is a
  discriminated union: `{ type: 'delta'; text: string } | { type: 'done' }
  | { type: 'error'; message: string }`.
- Preload bridge: `window.api.inlineEditStart(payload)`,
  `window.api.inlineEditCancel()`, `window.api.onInlineEditEvent(cb)` —
  following the exact naming/shape conventions already used for
  `cosmosSend`/`cosmosCancel`/`onCosmosEvent`.

`InlineEditManager` lives in a new `electron/inlineEdit.ts`, sibling to
`electron/autocomplete.ts`, and imports `resolveClaudePath` from that file
rather than duplicating PATH resolution — the two managers share the same
CLI location, and only one login-shell resolution should ever be needed
per app session regardless of which feature triggers it first.

## Settings

New `inlineEditSettingsStore` (localStorage-backed, same shape as
`autocompleteSettingsStore`): `enabled: boolean` (default `true`),
`model: string` (default **`claude-sonnet-5`**, not Haiku — this is a
deliberate, quality-sensitive, infrequent operation, not a per-keystroke
background suggestion, so the stronger default is worth the extra latency
and subscription usage). Same four selectable models as autocomplete
(Haiku 4.5, Sonnet 5, Opus 5, Fable 5).

New "Inline Edit" section on `src/components/Settings/ModelsSettingsPage.tsx`,
placed after the existing Autocomplete section, same shape (enable toggle +
model `<select>`).

## Error handling

Deliberately different from autocomplete's silent-null philosophy, because
this is a foreground, user-waited-on action:

- `claude` not found, spawn error, non-zero exit, or a stream that never
  produces a `done` event within a timeout → `{ type: 'error', message }`
  sent to the renderer, which shows a short, human-readable message
  ("Something went wrong — try again") inside the view zone in place of
  the (partial) generated text, with a dismiss action. The document is
  never touched.
- A timeout is still enforced (matching autocomplete's reasoning — no
  request should hang forever) but can be longer than autocomplete's 15s,
  since this is an explicit action the user is already waiting on rather
  than a background suggestion competing with the next keystroke — exact
  value is a plan-time decision, not a design-time one.
- Cancellation (Esc mid-generation, or a new Cmd+K request superseding an
  old one) is not an error — it silently tears down the UI with no message.

## Testing

Same layered approach as autocomplete:

- Pure functions (prompt building, NDJSON line parsing/delta extraction)
  unit tested directly, no mocking needed.
- `InlineEditManager` (spawn, per-window supersede, streaming event
  forwarding, cancellation, timeout) unit tested with mocked
  `child_process`, matching `AutocompleteManager`'s test patterns.
- Renderer-side state machine (idle → prompting → generating → reviewing →
  idle, plus error and cancel transitions) unit tested against a fake
  Monaco-shaped model/decorations/view-zone API, matching how
  `src/lib/monacoAutocomplete.ts` and `src/lib/autocompleteContext.ts`
  were tested without real Monaco.
- Actual content-widget positioning, view-zone rendering, and decoration
  styling verified manually in the running app — not practically
  unit-testable, consistent with how autocomplete's ghost-text rendering
  was handled.

## Out of scope (YAGNI)

- No status bar icon for this feature (autocomplete's icon stays
  autocomplete-specific; nothing was requested here).
- No multi-turn/follow-up conversation — one instruction produces one
  edit; asking a follow-up means invoking Cmd+K again.
- No multi-selection support (Monaco's primary selection only).
- No cross-file edits — same "current file only" scope as autocomplete.
- No streaming diff *animation* polish (e.g. token-by-token typewriter
  effects beyond the text simply growing) — functional correctness first.
