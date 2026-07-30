# Cosmos Tool Set Expansion — Design Spec

**Date:** 2026-07-30
**Status:** Approved
**Supersedes/extends:** `docs/superpowers/specs/2026-07-28-cosmos-agent-design.md` (tool set section only; architecture, approval flow, and Agent Mode toggle from that spec are unchanged)

## Summary

Expands the Cosmos tool set beyond the original five (`read_file`, `write_file`, `list_dir`, `search`, `run_command`) to fix the biggest usability risk identified before implementation: without a targeted edit tool, every change becomes a full-file `write_file`, which wastes tokens, fails on large files, and risks clobbering untouched code. This spec covers **Phase 1 only** — the file-operation tool set. Git tools, FIM autocomplete, terminal streaming, and mandatory diff-preview-in-Agent-Mode are recorded as a roadmap below but are out of scope here; each gets its own spec when its turn comes.

Confirmed architecture (unchanged from the 2026-07-28 spec): tool execution is entirely client-side. Huginn's Electron main process executes every tool call and feeds the result back to Cosmos over HTTP each round; Cosmos never touches the filesystem directly.

## Tool set changes

All tools below live in `COSMOS_TOOLS` (schema) and `executeTool` (implementation) in `electron/cosmos.ts`. `search` has not been committed yet (Task 3 is still in-progress/uncommitted), so it is renamed outright below rather than kept alongside a new tool.

| Tool | Change | Params | Behavior |
|---|---|---|---|
| `edit_file` | **new** | `path, old_string, new_string` | Reads the file, requires `old_string` to appear exactly once. 0 matches → error `"old_string not found in {path}"`. >1 matches → error `"old_string appears N times in {path} — include more surrounding context to make it unique"`. Exactly 1 match → replace and write. |
| `create_file` | **new** | `path, content` | Fails if `path` already exists: `"{path} already exists — use edit_file or write_file"`. Otherwise creates it. |
| `write_file` | unchanged (schema/impl) | `path, content` | Full overwrite, existing or new. System prompt now frames this as a last resort for existing files. |
| `read_file` | **extended** | `path, startLine?, endLine?` | 1-indexed, inclusive. Omitted → full file (current behavior unchanged). Out-of-range values clamp to the file's actual line count rather than erroring. |
| `glob_search` | **new** | `pattern, root?` | Filters `listAllFiles(root ?? cwd)` output through `minimatch`. New dependency: `minimatch` (small, standard, avoids hand-rolling glob semantics). |
| `grep_search` | **renamed from `search`** | `query, root?, caseSensitive?` | Same implementation (`searchText` from `fsOps.ts`), renamed for naming consistency with `glob_search`. |
| `delete_file` | **new** | `path` | `fs/promises.unlink`. |
| `move_file` | **new** | `from, to` | `fs/promises.rename`. |
| `list_dir`, `run_command` | unchanged | — | — |

## System prompt

A fixed preamble is sent as the leading system message on every Cosmos conversation (not just embedded in tool descriptions, since models weight system-prompt instructions more reliably than JSON-schema `description` fields for cross-cutting behavioral rules):

> When modifying an existing file, prefer `edit_file` over `write_file`. Full-file rewrites waste tokens, fail on large files, and risk changing untouched code. Use this priority order: (1) `edit_file` for any change to an existing file, (2) `write_file` only for complete rewrites explicitly requested by the user, (3) `create_file` only for files that don't exist yet.

## Approval / diff preview

Unchanged mechanism from the 2026-07-28 spec (no new diff-algorithm dependency): each tool gets a preview shown on its `need-approval` block.

- `edit_file`: shows `old_string` → `new_string` (the two strings, not a computed unified diff).
- `create_file` / `write_file`: shows the new content (existing behavior for `write_file`, same treatment for `create_file`).
- `delete_file`: shows `"This will delete {path}"`.
- `move_file`: shows `"This will rename {from} to {to}"`.

## Testing

Same pattern as the existing `cosmos.test.ts` tool-call tests: canned SSE tool-call streams, assert filesystem side effects and emitted events. New cases specifically for:

- `edit_file` success (single match), zero-match error, multi-match error.
- `create_file` success and already-exists error.
- `read_file` with a line range, and with range omitted (regression check).
- `glob_search` matching a pattern against a temp directory tree.
- `grep_search` (renamed test coverage carried over from the old `search` tests).
- `delete_file` / `move_file` success cases.

## Scope cuts (YAGNI)

- No fuzzy/whitespace-tolerant matching in `edit_file` — exact substring match only, matching the original capability doc's explicit wording ("find & replace exact string").
- No batch/multi-edit tool (editing multiple locations in one call) — one `edit_file` call per change, consistent with the existing 25-round-per-turn loop budget.
- No line-based (as opposed to string-based) edit tool — string matching only, per the capability doc.

## Roadmap (not this spec — future work, recorded so it isn't lost)

1. **Phase 1 (this spec):** file-operation tool set above.
2. **Phase 2 — Git tools:** `git_status`, `git_diff` first (needed almost every session), then `git_log`, then `git_add`/`git_commit`; `git_blame`/`git_branch` lower priority. Low implementation cost: `electron/git.ts` already exports `getGitStatus`, `getDiffContent`, `getGitGraph` (serves as log), `stageFiles`/`stageAll`, `commit` — these are thin wrappers, not new logic. `git_blame` has no existing backing function and would need one added when its turn comes.
3. **Phase 3 — FIM autocomplete:** a separate product from the agent loop. Needs its own Cosmos backend endpoint (`<fim_prefix>`/`<fim_suffix>`/`<fim_middle>`), built and verified before any Monaco ghost-text UI work starts.
4. **Phase 4 — Terminal streaming:** long-running process support (start/stop, live output) for `run_command`, replacing the current one-shot 60s-capped execution. Changes the approval gate UI to distinguish "ran once, here's the result" from "still running, here's the stream and a stop button."
5. **Phase 5 — Mandatory diff preview in Agent Mode:** even with auto-approve on, `write_file`/`edit_file`/`create_file` show a diff before applying, with a "reject and explain" path that feeds the rejection reason back into the tool loop instead of silently skipping.
