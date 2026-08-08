# Inline Autocomplete (Ghost-Text Completions) Design

**Goal:** Give Huginn's editor Cursor-style inline ghost-text autocomplete, powered by the user's existing Claude subscription via the `claude` CLI (no separate API key), with a status-bar toggle and settings-page controls.

## Background

Huginn has no direct Anthropic API integration today. The `claude` assistant
(`electron/claude.ts`) spawns the `claude` CLI interactively in a pty
terminal. "Cosmos" (`electron/cosmos.ts`) is a separate, generic
OpenAI-compatible bring-your-own-endpoint chat feature with its own
`endpoint`/`apiKey`/`modelId` settings. Neither is suitable for autocomplete:
the pty terminal isn't a request/response API, and Cosmos requires the user
to have configured a third-party key.

Instead, autocomplete calls `claude -p` (print/non-interactive mode)
as a one-shot child process per suggestion, authenticating via the same
subscription OAuth the user already has set up for the interactive `claude`
assistant. Confirmed CLI flags (via `claude --help`):

- `-p "<prompt>"` — print response and exit
- `--model <id>` — full model ID or alias (`sonnet`, `opus`, `fable`; Haiku
  needs its full ID, `claude-haiku-4-5-20251001`, no short alias exists)
- `--output-format text` — plain text stdout, no JSON wrapper
- `--no-session-persistence` — stateless, nothing written to resume later
- `--tools ""` — disables all built-in tools (no permission prompts, no
  risk of the completion call trying to edit files)
- `--setting-sources ""` — skips loading project/user CLAUDE.md (faster,
  and irrelevant to a single-line completion)
- `--system-prompt "<...>"` — the fill-in-the-middle instructions

**Do not use `--bare`.** It "skips ... keychain reads" and restricts auth to
`ANTHROPIC_API_KEY`/`apiKeyHelper` only — that would break subscription
OAuth entirely, which is the whole point of this design.

## Architecture

```
Monaco editor (renderer)
  → registerInlineCompletionsProvider (global, one-time registration)
    → debounce via Monaco's own CancellationToken (see below)
    → window.api.autocompleteComplete(prefix, suffix, language, model)
      → ipcMain.handle('autocomplete:complete', ...)
        → AutocompleteManager (electron/autocomplete.ts)
          → kill previous in-flight `claude -p` child for this window
          → spawn new `claude -p` child, capture stdout, 10s timeout
          → post-process (strip code fences if present, trim)
        ← resolved completion text | null
    ← Monaco InlineCompletion[] (insertText) | none
```

### Debounce and cancellation

Monaco calls `provideInlineCompletions(model, position, context, token)` on
every keystroke and cancels the *previous* call's token when a new one
fires. The provider itself does:

```
await sleep(700ms)
if (token.isCancellationRequested) return { items: [] }
// ...proceed to call the IPC bridge
```

This is the whole debounce mechanism — no timer bookkeeping needed in
component state.

On the main-process side, `AutocompleteManager` additionally tracks one
in-flight child process per window (`Map<windowId, ChildProcess>`) and kills
the previous one whenever a new completion request arrives for that window
— the same "supersede, don't queue" pattern `ClaudeManager` already uses for
attach/new/continue. This guards against a slow `claude -p` call outliving
several keystrokes' worth of newer, cancelled Monaco calls.

### Prompt (fill-in-the-middle)

Fixed system prompt (not user-editable): instructs Claude it is a code
completion engine, given `<prefix>`/`<suffix>` text around the cursor,
must output *only* the raw text to insert at the cursor — no
explanation, no markdown code fences, no repeating surrounding code. If no
reasonable completion exists, output nothing.

User-turn content: language ID (from Monaco's `model.getLanguageId()`) plus
the prefix (up to ~100 lines / ~4000 chars before the cursor) and suffix
(up to ~50 lines / ~2000 chars after), each capped to keep the call fast
and cheap. Current file only — no other open tabs, no project-wide search.

Response post-processing: strip a leading/trailing triple-backtick fence
defensively (in case the model doesn't fully follow the no-fences
instruction), trim trailing whitespace. Empty/whitespace-only responses are
treated as "no suggestion."

### Monaco wiring

- `languages.registerInlineCompletionsProvider('*', provider)` — registered
  once at module scope (not per editor instance; Monaco's registration is
  global across all editor instances of the matching language selector).
- Editors need `inlineSuggest: { enabled: true }` set explicitly in their
  options (verify current default; set explicitly regardless).
- Tab-to-accept and Esc-to-dismiss are Monaco's built-in inline-suggestion
  keybindings — no custom keydown handling required, consistent with how
  Editor.tsx already avoids hand-rolled key handling in favor of native
  editor/menu behavior where possible.

## Enable/disable model

Two independent layers:

1. **Persisted master switch** (`autocompleteSettingsStore`,
   localStorage-backed like the other settings stores): `enabled: boolean`
   (default `true`) and `model: string` (default
   `claude-haiku-4-5-20251001`, i.e. Haiku 4.5). Both are surfaced as
   controls in `EditorSettingsPage.tsx` — a toggle plus a model `<select>`
   listing Haiku 4.5 (default) / Sonnet 5 / Opus 5 / Fable 5.
2. **Session pause** (in-memory only, not persisted — a plain zustand store
   with no localStorage read/write, so it naturally resets to "not paused"
   on every app launch): `sessionPaused: boolean`.

Effective active state = `enabled AND NOT sessionPaused`. The inline
completions provider checks this before doing anything else — if inactive,
it returns `{ items: [] }` immediately with no IPC call, no child process,
no subscription usage.

## Status bar icon

Added to `StatusBar.tsx`'s existing right-hand control group, immediately
before the `−` (decrease zoom) button — same flex group, same visual
treatment as the existing zoom controls, following the inline-SVG icon
pattern already used by `GitIcon`/`TodoIcon` in `ActivityBar.tsx`
(`currentColor` stroke, `viewBox="0 0 24 24"`).

Three visual states:

- **on** — effective state active, no request currently in flight
- **working** — effective state active, a completion request is in flight
  (tracked by a renderer-only `busy` flag set immediately before calling
  `window.api.autocompleteComplete(...)` and cleared in a `finally`; no
  IPC needed to drive this, since the renderer already awaits the call)
- **off** — effective state inactive, for either reason (master switch off,
  or session-paused)

Left-click opens the same popup panel as right-click (avoids a dead click
target on an otherwise-interactive-looking icon) — the panel's content and
behavior are identical regardless of which click opened it.

The popup panel follows the existing
`onContextMenu`-triggered popup pattern already used for the git-branch
area and the font-size area in the same file:

- If the master switch (Settings) is on: shows **"Pause for this
  session"** when currently active, or **"Resume"** when currently
  session-paused. Toggles `sessionPaused`.
- If the master switch is off: shows an informational, non-interactive row
  — "Autocomplete is off in Settings" — since there is nothing session-level
  to pause or resume until the user re-enables it in Settings.

This mirrors the "quick pause vs. persistent master switch" model: the
right-click toggle is a fast, temporary, non-persisted override; the
Settings toggle is the saved preference and always wins when it's off.

## IPC surface

New handler, following the existing `cosmos:getSettings`/`cosmos:setSettings`
naming convention:

- `ipcMain.handle('autocomplete:complete', (event, prefix, suffix, language, model) => Promise<string | null>)`
  exposed via preload as `window.api.autocompleteComplete(prefix, suffix, language, model)`.

No new persisted-settings IPC is needed beyond this — `enabled` and `model`
live in localStorage via the zustand store, same as `editorSettingsStore`
and `modelSettingsStore`, not in the file-backed settings Cosmos uses (that
file-backed path exists specifically because Cosmos's API key shouldn't
live in renderer localStorage; the autocomplete store holds no secret, so
localStorage-only is consistent with `editorSettingsStore`/
`modelSettingsStore`).

## Error handling

Best-effort and silent, since this is a background convenience feature, not
a critical path:

- `claude` not found on PATH, non-zero exit, or a timed-out process → main
  process resolves `null`, logs to the Electron console; no toast, no
  terminal error surfaced to the user.
- The status bar icon does not gain a fourth "error" state for this — it
  simply shows `on` (idle) again once the failed request settles, matching
  how Copilot-style tools stay quiet on transient failures.

## Testing

Pure functions get unit tests (matching this codebase's existing test
coverage style, e.g. `src/stores/__tests__/fileStore.test.ts`):

- Prompt construction: prefix/suffix truncation at the line/char caps
- Response post-processing: code-fence stripping, trimming, empty-response
  handling
- `AutocompleteManager`'s "new request kills previous in-flight child for
  this window" behavior (mock `child_process`)
- `autocompleteSettingsStore` / session-pause store: default values,
  persistence round-trip, effective-state derivation

The actual ghost-text rendering and ghost-text accept/dismiss UX is
verified manually in the running app — Monaco's inline-completion widget
isn't practically unit-testable, consistent with how other editor-visual
features in this codebase are verified.

## Out of scope (YAGNI)

- Cross-file/open-tabs context (current file only, per explicit decision)
- Manual-trigger keybinding (automatic debounced trigger only, per explicit
  decision)
- Per-language enable/disable, custom system prompt editing, suggestion
  history/telemetry, multi-suggestion cycling — none of these were
  requested; add only if asked for later.
