# Cosmos Agent — Design Spec

**Date:** 2026-07-28
**Status:** Approved

## Summary

Add Cosmos as a third assistant option alongside Claude and Codex. Unlike those two, Cosmos is not a local CLI spawned in a pty — it's a locally-hosted model (running on a separate Mac, reached over a Thunderbolt bridge) exposed through an OpenAI-compatible `/v1/chat/completions` endpoint. Huginn talks to it directly: streams chat completions, offers it a fixed tool set (read/write files, list dir, search, run shell commands), and executes tool calls it emits — full agentic tool use, the same capability tier as Claude/Codex, just over HTTP instead of a CLI.

## Architecture

```
CosmosChat (renderer)
    ↕ IPC (cosmos:send / cosmos:approve / cosmos:reject / cosmos:cancel / cosmos:event)
CosmosManager (electron/cosmos.ts)
    ↕ fetch, SSE stream
Cosmos endpoint (http://<thunderbolt-ip>:8002/v1/chat/completions)
```

`CosmosManager` follows the same manager pattern as `ClaudeManager`/`GitRunner`/`MobileServer`: constructor accepts the `BrowserWindow`, exposes `registerHandlers()`, instantiated once in `main.ts`.

The renderer never talks to the Cosmos HTTP endpoint directly — it only sends user messages and approve/reject decisions over IPC and renders the events it receives. This keeps the API key and network fetch in the main process, consistent with how git/pty/mobile already work, and avoids CORS/CSP questions entirely.

### Agent loop (in `CosmosManager`)

1. Renderer sends `cosmos:send` with `{ cwd, messages, agentMode }`.
2. Manager POSTs to `{endpoint}/chat/completions` with `stream: true`, the running message history, and the fixed `tools` array (JSON schema below).
3. Manager parses the SSE stream, accumulating `delta.content` and `delta.tool_calls` chunks, forwarding text deltas to the renderer live as `{type: 'text-delta', delta}` events.
4. On `finish_reason: 'tool_calls'`: for each tool call —
   - If `agentMode` is off: send `{type: 'need-approval', id, name, args}` and await the renderer's `cosmos:approve`/`cosmos:reject` for that `id` (a pending-promise map keyed by tool-call id).
   - Execute the tool (see below), send `{type: 'tool-result', id, result}`.
   - Append the tool call + its result to the message history as `assistant`/`tool` messages.
   - Loop back to step 2 (capped at 25 tool-call rounds to guard against runaway loops; on hitting the cap, send an error event and stop).
5. On `finish_reason: 'stop'`: send `{type: 'done'}`.
6. Errors (network failure, non-2xx response, malformed stream) send `{type: 'error', message}` and stop the loop. No automatic retry — surfaced in the transcript, user retries manually.

`cosmos:cancel` aborts the in-flight `fetch` via `AbortController` and stops the loop early.

### Tool set

| Tool | Backing implementation | Notes |
|---|---|---|
| `read_file(path)` | `fs/promises.readFile` | same impl as `fs:readFile` |
| `write_file(path, content)` | `fs/promises.writeFile` | approval preview = diff against current content |
| `list_dir(path)` | `fs/promises.readdir` | same impl as `fs:readDir` |
| `search(query, caseSensitive)` | shared `searchText` | same impl as `fs:searchText` |
| `run_command(command)` | `child_process.execFile('/bin/zsh', ['-lc', command], {cwd, timeout: 60_000, maxBuffer: 10MB})` | one-shot, not the interactive pty terminal; captures stdout+stderr+exit code |

`listAllFiles`, `searchText`, and `buildTree` currently live as private functions inside `main.ts` backing the `fs:*` IPC handlers. They move to a new `electron/fsOps.ts` and both `main.ts` and `cosmos.ts` import from there — avoids duplicating this logic for the `search`/`list_dir` tools.

### Approval flow / Agent Mode

Default: every tool call blocks on a `need-approval` event, rendered inline on that tool-call block with Approve/Reject buttons (diff preview for `write_file`, exact command text for `run_command`).

**Agent Mode** (new `agentMode: boolean` in `cosmosStore`, `localStorage`-backed) skips the approval step entirely — tool calls execute immediately. Toggled by **Shift+Tab**, added as a new keydown handler alongside the existing Cmd+L handling, active while the Cosmos panel is the visible assistant panel. A small indicator in the `CosmosChat` header shows current mode so it's never ambiguous which one is active.

## Components

### `electron/cosmos.ts` (new)
`CosmosManager` class — connection settings (endpoint/API key/model) are read from the renderer-persisted settings on each `cosmos:send` call (passed in the IPC payload, not cached in main), so a settings change takes effect on the next message without an app restart.

### `electron/fsOps.ts` (new)
Extracted `listAllFiles`, `searchText`, `buildTree` from `main.ts`. Pure functions, no IPC concerns — imported by both `main.ts`'s `registerFsHandlers` and `cosmos.ts`.

### `src/stores/cosmosStore.ts` (new)
- `messages`: current transcript (role, content, tool-call blocks with status: `pending-approval` | `running` | `done` | `error`).
- `agentMode: boolean`, persisted to `localStorage`, toggled by Shift+Tab.
- `previousMessages`: last completed transcript, for the "previous session" action.
- `sendMessage`, `newSession`, `previousSession`, `approveToolCall`, `rejectToolCall`, `cancel` — same shape as `claudeStore`'s session actions where it makes sense.

### `src/stores/cosmosSettingsStore.ts` (new)
`endpoint`, `apiKey`, `modelId` — `localStorage`-backed, same pattern as `gitSettingsStore.ts` (`huginn:cosmos:endpoint` etc. keys).

### `src/components/Chat/CosmosChat.tsx` (new)
Chat-bubble panel: user/assistant message bubbles, markdown rendering via `react-markdown` (new dependency — a hand-rolled renderer isn't worth it for one feature), collapsible tool-call blocks showing status and, when expanded, the diff (file writes) or captured output (commands). Approve/Reject buttons render inline on `pending-approval` blocks.

### `src/components/Chat/Chat.tsx` (edit)
Branches on `assistant === 'cosmos'` to render `<CosmosChat />` instead of creating an xterm host for that slot. The surrounding container/resize/panel-visibility logic is unchanged.

### `src/components/Settings/CosmosSettingsPage.tsx` (new)
Endpoint / API Key / Model ID fields + "Test Connection" button (calls `cosmos:testConnection`, a one-shot `GET {endpoint}/models` or minimal completion call, returns ok/error). Added to `SettingsPanel.tsx`'s page list and `paths.ts`, following the existing `GitSettingsPage`/`EditorSettingsPage` pattern exactly.

### `src/App.tsx` (edit)
- `AssistantKind` gains `'cosmos'`.
- Assistant dropdown menu and right `ActivityBar` entry get a third option: a diamond icon (`CosmosIcon`, matching the Cosmos app's mark), label "Cosmos".
- New/Previous session buttons call into `cosmosStore`'s `newSession`/`previousSession` when `assistant === 'cosmos'`.
- The Claude-only (Compact/Clear/Usage) and Codex-only (Model/Fast) button groups stay as-is; Cosmos shows neither group for now (no equivalent actions).

### `electron/main.ts` / `electron/preload.ts` (edit)
Instantiate `CosmosManager`, register its handlers. Preload exposes `cosmosSend`, `cosmosApprove`, `cosmosReject`, `cosmosCancel`, `cosmosTestConnection`, `onCosmosEvent`.

### `src/components/Shortcuts/shortcuts.ts` (edit)
Add `{ keys: ['⇧', '⇥'], label: 'Toggle Cosmos Agent Mode' }` to the registry.

## Data flow summary

```
User types message in CosmosChat
  → cosmosStore.sendMessage → window.api.cosmosSend(cwd, messages, agentMode)
  → CosmosManager streams SSE from Cosmos endpoint
  → text-delta events append to the in-progress assistant bubble
  → tool-call → need-approval (unless agentMode) → user approves/rejects via IPC
  → tool executes (fsOps / execFile) → tool-result event → block updates to done/error
  → loop continues until finish_reason: 'stop' → done event → message finalized
```

## Testing

- Unit tests for `CosmosManager`'s SSE parsing / tool-call accumulation logic (feed it canned SSE chunks, assert emitted events), following the existing pattern in `electron/__tests__/claude.test.ts`.
- Unit tests for `fsOps.ts` (moved logic — should carry over existing coverage, if any, from `main.ts`).
- Component tests for `CosmosChat.tsx` (renders bubbles, tool-call block states, approve/reject wiring) using the existing Testing Library setup.
- Manual smoke test against the real Cosmos endpoint before considering the tool-calling loop done, since the SSE `tool_calls` shape is the one real integration risk here.

## Scope cuts (YAGNI)

- No multi-session history browser for Cosmos — current transcript + one "previous" slot only, matching what new/previous session already mean for Claude/Codex.
- No model picker/dropdown — Model ID is a single text field set once in Settings.
- No automatic retry/reconnect — a dropped connection surfaces as an error message in the transcript; user retries manually.
- No changes to Claude/Codex pty plumbing — Cosmos is fully additive.

## Open risk

Cosmos's `/v1/chat/completions` is confirmed to support the standard OpenAI `tools`/`tool_calls` streaming shape (already in use via VS Code chat extensions against the same endpoint). Still worth an early manual smoke test of the exact streaming/tool-call round trip before building the full approval-and-loop machinery on top of it.
