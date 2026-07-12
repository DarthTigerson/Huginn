# Git push/pull/fetch menu, force-push safety, and command log — Design

## Summary

Add Push, Pull, Fetch, Force Push, and Force Push with Lease to the app, triggered
from a right-click menu on the branch area of the footer. Force actions go through
a confirm modal that shows the target branch, with an optional countdown (a
last-second check that you're pushing to the right branch) configurable in a new
Git settings page. Every command streams its output live into a single reused
"Git Log" tab, the same tab-based UI editor tabs and diff tabs already use.

## Motivation

The footer currently only shows ahead/behind counts (read-only). There's no way to
act on them — the user has to drop to a terminal to push/pull. Force-push in
particular is a destructive, remote-history-rewriting action; the confirm modal
with a branch name and optional countdown exists specifically to give the user
(who may be about to force-push from muscle memory) one last look at which branch
it's actually going to.

## Out of scope

- Remote/branch selection UI — commands always operate on the current branch's
  configured upstream (`git push` / `git pull` / `git fetch` with no explicit
  remote or refspec args). If no upstream is configured, the command fails and
  that failure streams to the log tab like any other error.
- Interactive credential prompts (SSH passphrase, HTTPS username/password) beyond
  whatever the system's existing credential helper / SSH agent already handles
  non-interactively. `git` is spawned without a TTY, so any prompt that requires
  one will simply hang until the process errors out or times out; no code is
  added to detect or special-case this.
- Rebase-based pull, `--force-with-lease=<refname>:<expected>` variants, tags,
  or any push/pull flags beyond plain and the two force variants.
- Command history persistence across app restarts — the Git Log tab's content is
  in-memory only (`gitLogStore`), cleared on reload.
- Cancelling an in-flight git command from the UI.

## Architecture

### Backend: streaming command execution

`electron/git.ts` gains a command runner using `child_process.spawn('git', args, { cwd })`
(not `execFileAsync`) because output needs to reach the renderer as it's produced,
not after the process exits. This mirrors the existing `PtyManager` (`electron/pty.ts`)
pattern of "spawn once, stream events" rather than the `commit()` pattern of
"await and return a single result".

Command → args mapping:

| Action            | argv                              |
|--------------------|-----------------------------------|
| `fetch`            | `['fetch']`                       |
| `pull`              | `['pull']`                        |
| `push`              | `['push']`                        |
| `forcePush`         | `['push', '--force']`             |
| `forcePushLease`    | `['push', '--force-with-lease']`  |

Flow:

1. Renderer generates `id = crypto.randomUUID()` **before** invoking, and subscribes
   its `onGitLogData`/`onGitLogExit` listeners before calling `gitRunCommand` — this
   ordering avoids a race where main could emit before the renderer is listening.
2. Renderer calls `window.api.gitRunCommand(id, cwd, action)`. The IPC handler
   (`ipcMain.handle('git:runCommand', ...)`) starts the spawn and resolves
   immediately (fire-and-forget); it does not await process completion.
3. Main process guards against overlap: it tracks one in-flight `ChildProcess` at a
   time. If `gitRunCommand` is called while one is already running, it immediately
   emits a `git:log:exit` with a non-zero synthetic code and an error string
   ("A git command is already running") for that `id`, and does not spawn.
4. stdout and stderr are both merged and streamed as `git:log:data` events,
   `{ id, data }` (same merge-both-streams approach `PtyManager` uses for the
   terminal).
5. On process `close`, main sends `git:log:exit` `{ id, code }`. On spawn error
   (e.g. git binary missing), main sends one `git:log:data` with the error message
   followed by a `git:log:exit` with a non-zero code.
6. The renderer-side UI layer (not the low-level IPC) additionally prevents a
   second command from being *triggered* while one is running, by disabling the
   menu's action items whenever `gitStore.commandStatus === 'running'`. The
   backend guard in step 3 exists as a defensive fallback, not the primary
   mechanism.

`preload.ts` additions:

```ts
gitRunCommand: (id: string, cwd: string, action: GitCommandAction) =>
  ipcRenderer.invoke('git:runCommand', id, cwd, action),
onGitLogData: (cb: (id: string, data: string) => void) => () => void,
onGitLogExit: (cb: (id: string, code: number) => void) => () => void,
```

### State

**`gitStore`** (extended, not a new store — it already owns git IPC calls):

- `commandStatus: 'idle' | 'running'`
- new actions `fetch(cwd)`, `pull(cwd)`, `push(cwd)`, `forcePush(cwd)`,
  `forcePushLease(cwd)` — each: bail out if `commandStatus === 'running'`; else
  generate an id, subscribe one-shot listeners, set `commandStatus: 'running'`,
  append a `> git <args>` header line to `gitLogStore`, call
  `window.api.gitRunCommand`. On `git:log:data` for that id, append to
  `gitLogStore`. On `git:log:exit` for that id: unsubscribe, set
  `commandStatus: 'idle'`, and if `code === 0` call `get().refresh(cwd)` (refreshes
  branch, ahead/behind, and status — matters most for `pull`, which can change
  tracked files the Git Panel lists).

**`gitLogStore`** (new, `src/stores/gitLogStore.ts`):

- `text: string`
- `append(chunk: string): void` — no `clear`; runs stack in one continuous log
  for the session, separated by header lines, like an output console.

**`gitSettingsStore`** (new, `src/stores/gitSettingsStore.ts`, plain-localStorage
pattern like `displayStore.ts` — this codebase doesn't use zustand's `persist`
middleware anywhere):

- `forceSafetyEnabled: boolean` — default `true`
- `countdownEnabled: boolean` — default `false`
- `countdownSeconds: number` — default `5`
- `autoContinueOnCountdownEnd: boolean` — default `false`

### UI components

**`GitActionsMenu`** (new, `src/components/Git/` or `src/components/StatusBar/`) —
right-click on the branch/icon area of `StatusBar` (currently just a `<span>`,
`StatusBar.tsx:32-42`) opens a dropdown using the same absolute `bottom-full`
positioning the existing font-size menu (`StatusBar.tsx:62-72`) already
demonstrates. Lists: Fetch, Pull, Push, Force Push, Force Push with Lease. Each
item is disabled (dimmed, non-interactive) while `gitStore.commandStatus ===
'running'`. Clicking Fetch/Pull/Push calls the matching `gitStore` action directly
and closes the menu. Clicking a force item closes the menu and opens the confirm
modal instead of running immediately — unless `forceSafetyEnabled` is `false`, in
which case it runs immediately with no modal at all.

**`ConfirmForcePushModal`** (new) — built on a new generic `Modal` primitive
(dimmed backdrop, centered card, closes on Escape or backdrop click) since none
exists in the app yet. Content: `Force push to origin/<branch>?` where
`<branch>` comes from `gitStore.branch`. Button area behavior:

- `countdownEnabled === false`: **Cancel** and **Confirm** buttons, side by side.
  Cancel closes the modal with no action. Confirm closes the modal and runs
  `forcePush`/`forcePushLease`.
- `countdownEnabled === true`: **Cancel** button plus a countdown display (e.g.
  "5…4…3…") where Confirm would be, ticking down once per second starting from
  `countdownSeconds`. Cancel is clickable at any point during the countdown and
  aborts with no action. At zero:
  - `autoContinueOnCountdownEnd === true`: modal closes automatically and the
    command runs — no further click needed.
  - `autoContinueOnCountdownEnd === false`: the countdown display is replaced by
    a **Confirm** button (Cancel remains available); the user must click it.

**`GitSettingsPage`** (new, `src/components/Settings/GitSettingsPage.tsx`, styled
like `DisplayPage.tsx`'s sectioned-card layout) — added as `settings://Git`
(`GIT_SETTINGS_TAB_PATH` in `Settings/paths.ts`) and listed in `SettingsPanel.tsx`
alongside "Display". Three controls bound to `gitSettingsStore`:

1. Toggle — "Confirm before force-pushing" (`forceSafetyEnabled`)
2. Toggle — "Countdown before confirming" (`countdownEnabled`), with a
   number input for seconds next to it, enabled only when the toggle is on
3. Toggle — "Continue automatically when countdown ends"
   (`autoContinueOnCountdownEnd`), enabled only when countdown is on

**`GitLogView`** (new, `src/components/Git/GitLogView.tsx`) — rendered by
`Editor.tsx` for the single fixed tab path `GIT_LOG_TAB_PATH = 'git-log://Git Log'`
(mirroring how `isVirtual`/`isDiff` are checked and branched on today, `Editor.tsx:18-19,56-70`).
A plain monospace, read-only, auto-scrolling `<pre>`-style view bound to
`gitLogStore.text` — not `xterm.js`; there's no interactivity or ANSI/TTY output
to render since git is spawned without a TTY. Opened/focused via the existing
`openTab` dedup-by-path behavior (`editorStore.ts:17-24`) every time any of the 5
commands starts, so repeated commands reuse the same tab instead of stacking new
ones.

**Footer** (`StatusBar.tsx`) — while `commandStatus === 'running'`, the ↓/↑
ahead/behind area is replaced by a small spinner. On completion (success or
failure) it reverts straight back to the normal branch/counts display — no
lingering "Done"/"Failed" text, since the Git Log tab is now the actual place to
see what happened.

## Data flow (push example)

1. User right-clicks footer branch area → `GitActionsMenu` opens.
2. User clicks "Push" → `gitStore.push(cwd)`.
3. Store: `commandStatus = 'running'`, id generated, `gitLogStore.append('> git push\n')`,
   subscribes `onGitLogData`/`onGitLogExit` for that id, opens/focuses the Git Log
   tab, calls `window.api.gitRunCommand(id, cwd, 'push')`.
4. Footer shows spinner in place of counts.
5. Main spawns `git push`, streams merged stdout/stderr chunks → `git:log:data` →
   `gitLogStore.append(chunk)` → `GitLogView` (if open) auto-scrolls to show them.
6. Process exits 0 → `git:log:exit` → store unsubscribes, `commandStatus = 'idle'`,
   `refresh(cwd)` re-fetches branch/ahead-behind/status.
7. Footer spinner clears, reverts to updated counts (ahead should now be 0 or
   reduced).

Force push example differs only at step 2: clicking "Force Push" opens
`ConfirmForcePushModal` first (unless safety is off); confirming there is what
calls `gitStore.forcePush(cwd)`, continuing from step 3 identically.

## Error handling

- No error is caught/wrapped into a generic message anywhere in this flow — git's
  own stderr output (e.g. "! [rejected]", "fatal: no upstream branch", merge
  conflict text on pull) streams into the log tab verbatim, since that's the
  actual explanation and rewriting it would just lose information.
- The only thing the rest of the UI needs from a finished command is the exit
  code: `0` triggers `refresh()`, non-zero does not (avoids clobbering
  `gitStore.status`/`aheadBehind` with a possibly-unchanged state after a failed
  op — though a re-fetch would be harmless too, skipping it just avoids the extra
  IPC round trip on the common "same as before" failure case).
- If two commands somehow overlap (should be prevented by the disabled menu
  items), the backend's single in-flight guard rejects the second with a
  synthetic failing exit rather than interleaving two processes' output in the
  log.

## Testing

- `electron/__tests__/git.test.ts` (existing file covers `parsePorcelainStatus`
  etc. — extend it): argv mapping for each of the 5 actions: force the spawn to
  emit known stdout/stderr chunks and a known exit code, assert the right
  `git:log:data`/`git:log:exit` IPC sends happen in order; assert the overlap
  guard rejects a second call while one is in-flight.
- `src/stores/__tests__/gitStore.test.ts` (existing — extend): each new action
  sets `commandStatus` correctly across the run, appends to `gitLogStore`, and
  calls `refresh` only on exit code 0.
- `src/stores/__tests__/gitSettingsStore.test.ts` (new): defaults, localStorage
  round-trip for all four fields.
- Component-level: `ConfirmForcePushModal` countdown behavior (fake timers) for
  all four combinations of `countdownEnabled` × `autoContinueOnCountdownEnd`,
  and that Cancel aborts at any point without running the command.
