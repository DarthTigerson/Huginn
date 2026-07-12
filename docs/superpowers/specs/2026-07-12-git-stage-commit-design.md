# Git Stage/Unstage/Commit — Design

## Goal

Turn the Git Panel from a static placeholder into a working VSCode-style
staging area: see staged vs. unstaged changes, stage/unstage individual
files or all at once, write a commit message, commit, and click a file to
view its diff. Hunk-level staging and diff editing are explicitly out of
scope for this pass.

## Architecture

Git operations currently live inline in `electron/main.ts`
(`getGitBranch` + `registerGitHandlers`). This spec extracts and expands
that into a new `electron/git.ts` module, following the same
one-file-per-concern pattern as `pty.ts`/`claude.ts`. `main.ts` calls
`registerGitHandlers()` from the new module instead of defining it
inline; `getGitBranch` moves there too so all git logic is in one place.

All new git operations are stateless request/response IPC calls (no
persistent process, unlike PTY/Claude), so `git.ts` just exports plain
async functions plus a `registerGitHandlers(win)` function — no class
needed.

## Backend: `electron/git.ts`

```ts
interface GitFileEntry {
  path: string
  status: 'M' | 'A' | 'D' | 'R' | '?'
}

interface GitStatus {
  staged: GitFileEntry[]
  unstaged: GitFileEntry[]
}
```

- `getGitBranch(cwd)` — moved verbatim from `main.ts`.
- `getGitStatus(cwd): Promise<GitStatus>` — runs
  `git status --porcelain=v1 -z`, parses the two-letter XY status codes
  per entry into the staged/unstaged lists. `-z` avoids quoting/escaping
  issues with filenames. Renames (`R`) carry the new path only for this
  pass (old path is not surfaced in the UI). The porcelain-line parser is
  a separate pure function (`parsePorcelainStatus(raw: string): GitStatus`)
  so it's unit-testable without invoking git.
- `stageFiles(cwd, paths: string[])` — `git add --  <paths>`
- `unstageFiles(cwd, paths: string[])` — `git reset --  <paths>`
- `stageAll(cwd)` — `git add -A`
- `unstageAll(cwd)` — `git reset`
- `commit(cwd, message): Promise<{ ok: true } | { ok: false; error: string }>`
  — runs `git commit -m <message>`; on non-zero exit, captures stderr as
  `error` instead of throwing.
- `getDiffContent(cwd, path, staged: boolean): Promise<{ original: string; modified: string }>`
  — builds full before/after file contents (not a patch):
  - staged diff: `original` = `git show HEAD:<path>` (empty string if the
    file has no HEAD version, i.e. newly added), `modified` = `git show :<path>`
  - unstaged diff: `original` = `git show :<path>` (empty string if not in
    the index, i.e. untracked), `modified` = disk read via `fs.readFile`
    (empty string if the file was deleted from the working tree)

  `git show` failures (missing blob) are caught and treated as `''`
  rather than propagated.

### IPC channels

| channel | args | returns |
|---|---|---|
| `git:branch` | `cwd` | `string \| null` (unchanged) |
| `git:status` | `cwd` | `GitStatus` |
| `git:stage` | `cwd, paths[]` | `void` |
| `git:unstage` | `cwd, paths[]` | `void` |
| `git:stageAll` | `cwd` | `void` |
| `git:unstageAll` | `cwd` | `void` |
| `git:commit` | `cwd, message` | `{ ok: true } \| { ok: false; error: string }` |
| `git:diff` | `cwd, path, staged` | `{ original: string; modified: string }` |

`electron/preload.ts` gets matching `window.api.*` entries for each.

## Renderer: `src/stores/gitStore.ts`

Extends the existing store:

```ts
interface GitStore {
  branch: string | null
  status: GitStatus            // default { staged: [], unstaged: [] }
  commitMessage: string
  commitError: string | null
  refresh: (cwd: string | null) => Promise<void>       // existing, also refreshes status
  refreshStatus: (cwd: string | null) => Promise<void>
  stage: (cwd: string, path: string) => Promise<void>   // stage + refreshStatus
  unstage: (cwd: string, path: string) => Promise<void>
  stageAll: (cwd: string) => Promise<void>
  unstageAll: (cwd: string) => Promise<void>
  setCommitMessage: (msg: string) => void
  commit: (cwd: string) => Promise<void>                // uses commitMessage; on success clears message + refreshes; on failure sets commitError
}
```

`refresh` (called today on project change / window focus in
`StatusBar.tsx`) is extended to also call `refreshStatus`, so status
tracks the same triggers the branch already uses — no new refresh
wiring needed in `StatusBar.tsx`.

## UI: `src/components/Git/GitPanel.tsx`

Replaces the "No changes" placeholder with:

1. **Commit box** — a styled `<textarea>` (not default browser styling —
   matches the app's dark input aesthetic, e.g. `bg-bg border border-border
   rounded`) bound to `commitMessage`, placeholder "Message", and a
   Commit button below it using the same accent-pill visual language as
   the Graph/List Diff/GG buttons. Disabled when `commitMessage` is empty
   or `status.staged.length === 0`. `commitError`, if set, renders as
   small red text under the box.
2. **Staged Changes** section — header row "Staged Changes (N)" with a
   small "unstage all" icon button; below it, one row per staged file:
   status-letter badge (color-coded: M amber, A green, D red, R blue, ?
   gray), truncated filename (full path as `title`), and a hover-revealed
   unstage (−) icon button on the right. Row click opens the diff tab.
3. **Changes** section — same shape for `status.unstaged`, with "stage
   all" and a stage (+) button per row.
4. Falls back to the current "No changes" empty state only when both
   lists are empty.
5. The existing Graph/List Diff/GG pill row stays below, untouched.

A new `src/components/Git/FileRow.tsx` holds the shared row rendering
(badge + name + action button) to avoid duplicating markup between the
two sections.

## Diff tab: `src/components/Editor/Editor.tsx`

New virtual path convention, parallel to `settings://`:
`git-diff://staged/<absolute-path>` and `git-diff://unstaged/<absolute-path>`.
Lives in a new `src/components/Git/paths.ts` (mirrors
`Settings/paths.ts`): `isGitDiffTab(path)`, `buildGitDiffPath(path, staged)`,
`parseGitDiffPath(path) -> { path, staged }`.

Clicking a file row calls
`editorStore.openTab({ path: buildGitDiffPath(file.path, staged), content: '', dirty: false })`.
`Editor.tsx` checks `isGitDiffTab(activeTab.path)`; if true, it fetches
`{ original, modified }` via `window.api.gitDiff` in a `useEffect` keyed
on the tab path (fetched once per tab open, not live-updating while
open) and renders `@monaco-editor/react`'s `DiffEditor` in read-only mode
(`options: { readOnly: true, renderSideBySide: true }`), using the same
`monacoTheme`/`fontSize`/`font` values as the normal editor. `TabBar`
needs no changes: it already derives the tab label via
`tab.path.split('/').pop()`, and since the real absolute file path is
appended as-is after the `git-diff://staged/` or `git-diff://unstaged/`
prefix, that split still resolves to the plain filename (e.g.
`git-diff://staged//Users/x/proj/foo.ts` → `foo.ts`), not the raw
virtual URL.

The Cmd+S guard in `Editor.tsx` (currently skips `settings://` paths) is
extended to also skip `git-diff://` paths, since diff tabs are read-only
and have no real file to write.

## Data flow summary

Open a project → `refresh(cwd)` fires (existing trigger) → status loads
→ GitPanel renders staged/unstaged lists → click + on a file → IPC
`git:stage` → `refreshStatus` → list re-renders with file moved to
Staged → click file row → diff tab opens → `git:diff` fetches
before/after content → Monaco DiffEditor renders it → type a commit
message → click Commit → IPC `git:commit` → on success, message clears
and `refresh` re-runs (status + branch); on failure, `commitError` shows
inline.

## Error handling

- `git:commit` failure (no staged changes, unconfigured git identity,
  merge conflicts, etc.) — caught in the main-process handler, returned
  as `{ ok: false, error: stderr }` rather than throwing across IPC;
  surfaced as inline red text in the commit box.
- `git:stage`/`unstage`/`stageAll`/`unstageAll` failures — logged via
  `console.error` in the renderer; status is re-fetched regardless so the
  UI stays consistent with actual repo state even if one call silently
  no-ops (e.g. a file deleted externally between render and click).
- `git:diff` — `git show` failures for missing blobs are treated as
  empty string (see above), not surfaced as errors, since "file didn't
  exist at that ref" is the expected case for new/deleted files.
- No project open / `cwd` null — all new store actions no-op the same
  way `refresh` already does today.

## Explicitly out of scope (future work)

- Hunk-level staging
- Editable diff view / saving from the diff tab
- Discard changes
- The Graph and List Diff placeholder buttons (unrelated existing
  placeholders, not touched by this spec)
- Merge conflict resolution UI
- Amend / undo last commit

## Testing

- `electron/__tests__/git.test.ts` (new): unit tests for
  `parsePorcelainStatus` covering modified/added/deleted/renamed/
  untracked entries and mixed staged+unstaged status on the same file
  (e.g. `MM`), following the existing `vi.mock('electron', ...)` +
  `ipcMain.handle` capture pattern used in `claude.test.ts` for the
  handler registration tests.
- Manual verification (per `verify`/`run` skill): open a real repo with
  a mix of staged, unstaged, and untracked changes; confirm both lists
  render correctly, stage/unstage/stage-all/unstage-all all update the
  lists and persist to actual `git status`, clicking a file opens a
  correct diff, committing with a message clears staged changes and the
  message box, and an empty repo (no changes) still shows "No changes".
