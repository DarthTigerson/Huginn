# Git Stage/Unstage/Commit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Git Panel from a static placeholder into a working VSCode-style staging area: staged/unstaged file lists, stage/unstage per-file and all-at-once, a commit message box with a Commit button, and click-to-diff on any file.

**Architecture:** A new `electron/git.ts` main-process module (mirroring the existing `pty.ts`/`claude.ts` one-module-per-concern pattern) wraps the `git` CLI via `execFile` and exposes IPC channels. The renderer's `gitStore.ts` grows to hold status/commit state, `GitPanel.tsx` renders it as staged/unstaged lists with a commit box, and clicking a file opens a read-only Monaco `DiffEditor` in a new virtual tab type (`git-diff://...`), following the same virtual-tab pattern the `settings://` pages already use in `Editor.tsx`.

**Tech Stack:** Electron (main/preload/renderer), React, Zustand, `@monaco-editor/react` (already a dependency), Vitest.

## Global Constraints

- Whole-file staging only — no hunk-level staging (spec: "Explicitly out of scope").
- Diff view is read-only — no editing from the diff tab, no discard-changes action (spec: "Explicitly out of scope").
- Backend git operations return structured results (`{ ok, error }` for commit) rather than throwing across IPC.
- Follow existing code conventions exactly: `execFileAsync` pattern from `electron/main.ts`, Zustand store shape from `src/stores/gitStore.ts`/`fileStore.ts`, virtual-tab pattern from `src/components/Settings/paths.ts` + `Editor.tsx`.
- New pure-logic code (porcelain status parser, git-diff path helpers) gets unit tests; code that only wraps real `git`/`fs` calls is verified manually, per the spec's Testing section.

---

### Task 1: Backend git module (`electron/git.ts`)

**Files:**
- Create: `electron/git.ts`
- Create: `electron/__tests__/git.test.ts`
- Modify: `electron/main.ts` (remove inline git code, delegate to the new module)

**Interfaces:**
- Produces: `getGitBranch(cwd: string): Promise<string | null>`, `parsePorcelainStatus(raw: string): GitStatus`, `getGitStatus(cwd: string): Promise<GitStatus>`, `stageFiles(cwd: string, paths: string[]): Promise<void>`, `unstageFiles(cwd: string, paths: string[]): Promise<void>`, `stageAll(cwd: string): Promise<void>`, `unstageAll(cwd: string): Promise<void>`, `commit(cwd: string, message: string): Promise<{ ok: true } | { ok: false; error: string }>`, `getDiffContent(cwd: string, path: string, staged: boolean): Promise<{ original: string; modified: string }>`, `registerGitHandlers(): void`, and types `GitFileEntry = { path: string; status: 'M' | 'A' | 'D' | 'R' | '?' }`, `GitStatus = { staged: GitFileEntry[]; unstaged: GitFileEntry[] }`.
- Consumes: nothing from other tasks (this is the foundation task).

- [ ] **Step 1: Write the failing tests for `parsePorcelainStatus`**

Create `electron/__tests__/git.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: () => {} },
}))

import { parsePorcelainStatus } from '../git'

describe('parsePorcelainStatus', () => {
  it('returns empty lists for no changes', () => {
    expect(parsePorcelainStatus('')).toEqual({ staged: [], unstaged: [] })
  })

  it('parses a staged modification', () => {
    const raw = 'M  src/foo.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/foo.ts', status: 'M' }],
      unstaged: [],
    })
  })

  it('parses an unstaged modification', () => {
    const raw = ' M src/foo.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [],
      unstaged: [{ path: 'src/foo.ts', status: 'M' }],
    })
  })

  it('parses a file staged and modified again (MM)', () => {
    const raw = 'MM src/foo.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/foo.ts', status: 'M' }],
      unstaged: [{ path: 'src/foo.ts', status: 'M' }],
    })
  })

  it('parses a staged addition', () => {
    const raw = 'A  src/new.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/new.ts', status: 'A' }],
      unstaged: [],
    })
  })

  it('parses an unstaged deletion', () => {
    const raw = ' D src/gone.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [],
      unstaged: [{ path: 'src/gone.ts', status: 'D' }],
    })
  })

  it('parses an untracked file', () => {
    const raw = '?? src/scratch.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [],
      unstaged: [{ path: 'src/scratch.ts', status: '?' }],
    })
  })

  it('parses a staged rename, skipping the old-path field and keeping the new path', () => {
    const raw = 'R  src/renamed.ts\0src/old-name.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/renamed.ts', status: 'R' }],
      unstaged: [],
    })
  })

  it('parses multiple mixed entries', () => {
    const raw = 'M  a.ts\0?? b.ts\0 D c.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'a.ts', status: 'M' }],
      unstaged: [
        { path: 'b.ts', status: '?' },
        { path: 'c.ts', status: 'D' },
      ],
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run electron/__tests__/git.test.ts`
Expected: FAIL — `Cannot find module '../git'` (the file doesn't exist yet).

- [ ] **Step 3: Write `electron/git.ts`**

```ts
import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'
import { join } from 'path'

const execFileAsync = promisify(execFile)

export interface GitFileEntry {
  path: string
  status: 'M' | 'A' | 'D' | 'R' | '?'
}

export interface GitStatus {
  staged: GitFileEntry[]
  unstaged: GitFileEntry[]
}

export async function getGitBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })
    const branch = stdout.trim()
    if (branch !== 'HEAD') return branch
    const { stdout: sha } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd })
    return sha.trim()
  } catch {
    return null
  }
}

function toStatus(code: string): GitFileEntry['status'] {
  return code === 'A' || code === 'D' || code === 'R' ? code : 'M'
}

export function parsePorcelainStatus(raw: string): GitStatus {
  const staged: GitFileEntry[] = []
  const unstaged: GitFileEntry[] = []
  if (!raw) return { staged, unstaged }

  const entries = raw.split('\0').filter(Boolean)
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const x = entry[0]
    const y = entry[1]
    const path = entry.slice(3)

    if (x === 'R') {
      // porcelain -z emits the old path as a separate NUL-terminated
      // field right after a rename entry — skip over it
      i++
    }

    if (x === '?' && y === '?') {
      unstaged.push({ path, status: '?' })
      continue
    }

    if (x !== ' ' && x !== '?') {
      staged.push({ path, status: toStatus(x) })
    }
    if (y !== ' ' && y !== '?') {
      unstaged.push({ path, status: toStatus(y) })
    }
  }

  return { staged, unstaged }
}

export async function getGitStatus(cwd: string): Promise<GitStatus> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain=v1', '-z'], { cwd })
    return parsePorcelainStatus(stdout)
  } catch {
    return { staged: [], unstaged: [] }
  }
}

export async function stageFiles(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await execFileAsync('git', ['add', '--', ...paths], { cwd })
}

export async function unstageFiles(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await execFileAsync('git', ['reset', '--', ...paths], { cwd })
}

export async function stageAll(cwd: string): Promise<void> {
  await execFileAsync('git', ['add', '-A'], { cwd })
}

export async function unstageAll(cwd: string): Promise<void> {
  await execFileAsync('git', ['reset'], { cwd })
}

export async function commit(
  cwd: string,
  message: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await execFileAsync('git', ['commit', '-m', message], { cwd })
    return { ok: true }
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr
    return { ok: false, error: stderr?.trim() || 'Commit failed' }
  }
}

async function showRef(cwd: string, ref: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['show', ref], { cwd })
    return stdout
  } catch {
    return ''
  }
}

export async function getDiffContent(
  cwd: string,
  path: string,
  staged: boolean
): Promise<{ original: string; modified: string }> {
  if (staged) {
    const original = await showRef(cwd, `HEAD:${path}`)
    const modified = await showRef(cwd, `:${path}`)
    return { original, modified }
  }

  const original = await showRef(cwd, `:${path}`)
  let modified = ''
  try {
    modified = await readFile(join(cwd, path), 'utf-8')
  } catch {
    modified = ''
  }
  return { original, modified }
}

export function registerGitHandlers(): void {
  ipcMain.handle('git:branch', (_e, cwd: string) => getGitBranch(cwd))
  ipcMain.handle('git:status', (_e, cwd: string) => getGitStatus(cwd))
  ipcMain.handle('git:stage', (_e, cwd: string, paths: string[]) => stageFiles(cwd, paths))
  ipcMain.handle('git:unstage', (_e, cwd: string, paths: string[]) => unstageFiles(cwd, paths))
  ipcMain.handle('git:stageAll', (_e, cwd: string) => stageAll(cwd))
  ipcMain.handle('git:unstageAll', (_e, cwd: string) => unstageAll(cwd))
  ipcMain.handle('git:commit', (_e, cwd: string, message: string) => commit(cwd, message))
  ipcMain.handle('git:diff', (_e, cwd: string, path: string, staged: boolean) =>
    getDiffContent(cwd, path, staged)
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run electron/__tests__/git.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Wire `main.ts` to the new module**

In `electron/main.ts`, remove the inline `execFileAsync`-based `getGitBranch` function and `registerGitHandlers` function (lines defining them), and remove `execFile`/`promisify`/`execFileAsync` if nothing else in the file still uses them — check first: `buildTree`, `readdir`, `readFile`, `writeFile` don't use `execFileAsync`, so it becomes unused once git code is removed. Replace with an import from the new module.

Change the top of `electron/main.ts` from:

```ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { readdir, readFile, writeFile } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { PtyManager } from './pty'
import { ClaudeManager } from './claude'

const execFileAsync = promisify(execFile)
```

to:

```ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { readdir, readFile, writeFile } from 'fs/promises'
import { PtyManager } from './pty'
import { ClaudeManager } from './claude'
import { registerGitHandlers } from './git'
```

Then delete this whole block (the inline `getGitBranch` function and `registerGitHandlers` function):

```ts
async function getGitBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })
    const branch = stdout.trim()
    if (branch !== 'HEAD') return branch
    const { stdout: sha } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd })
    return sha.trim()
  } catch {
    return null
  }
}

function registerGitHandlers(): void {
  ipcMain.handle('git:branch', (_e, cwd: string) => getGitBranch(cwd))
}
```

(`registerGitHandlers()` is still called from `app.whenReady().then(...)` — that call site does not change, it now resolves to the imported function.)

- [ ] **Step 6: Type-check and run the full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: `tsc` produces no output (clean). Vitest shows the new `electron/__tests__/git.test.ts` passing alongside the existing suites. Note: `src/stores/__tests__/fileStore.test.ts` has one pre-existing unrelated failure (`localStorage is not defined`) — confirm the failure count matches what existed before this task (1 failed / 16 passed becomes 1 failed / 25 passed), not a new failure.

- [ ] **Step 7: Commit**

```bash
git add electron/git.ts electron/__tests__/git.test.ts electron/main.ts
git commit -m "$(cat <<'EOF'
feat: extract git operations into electron/git.ts with status/stage/commit/diff support

Moves the inline branch lookup out of main.ts into a dedicated module
alongside new git status parsing, stage/unstage, commit, and diff
content IPC handlers, laying the backend groundwork for the Git Panel.
EOF
)"
```

---

### Task 2: Preload bridge and renderer type declarations

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/types/index.ts`
- Modify: `src/types/api.d.ts`

**Interfaces:**
- Consumes: IPC channel names from Task 1 (`git:status`, `git:stage`, `git:unstage`, `git:stageAll`, `git:unstageAll`, `git:commit`, `git:diff`).
- Produces: `window.api.gitStatus/gitStage/gitUnstage/gitStageAll/gitUnstageAll/gitCommit/gitDiff`, and renderer-side types `GitFileEntry`, `GitStatus`, `GitCommitResult`, `GitDiffContent` (exported from `src/types/index.ts`) for Task 3+ to import.

- [ ] **Step 1: Add renderer-side git types**

In `src/types/index.ts`, add after the existing `Tab` interface:

```ts
export interface GitFileEntry {
  path: string
  status: 'M' | 'A' | 'D' | 'R' | '?'
}

export interface GitStatus {
  staged: GitFileEntry[]
  unstaged: GitFileEntry[]
}

export type GitCommitResult = { ok: true } | { ok: false; error: string }

export interface GitDiffContent {
  original: string
  modified: string
}
```

- [ ] **Step 2: Extend the preload bridge**

In `electron/preload.ts`, change:

```ts
  gitBranch: (cwd: string) => ipcRenderer.invoke('git:branch', cwd),
```

to:

```ts
  gitBranch: (cwd: string) => ipcRenderer.invoke('git:branch', cwd),
  gitStatus: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
  gitStage: (cwd: string, paths: string[]) => ipcRenderer.invoke('git:stage', cwd, paths),
  gitUnstage: (cwd: string, paths: string[]) => ipcRenderer.invoke('git:unstage', cwd, paths),
  gitStageAll: (cwd: string) => ipcRenderer.invoke('git:stageAll', cwd),
  gitUnstageAll: (cwd: string) => ipcRenderer.invoke('git:unstageAll', cwd),
  gitCommit: (cwd: string, message: string) => ipcRenderer.invoke('git:commit', cwd, message),
  gitDiff: (cwd: string, path: string, staged: boolean) =>
    ipcRenderer.invoke('git:diff', cwd, path, staged),
```

- [ ] **Step 3: Extend the `window.api` type declaration**

In `src/types/api.d.ts`, change the import line:

```ts
import type { FileNode } from './index'
```

to:

```ts
import type { FileNode, GitStatus, GitCommitResult, GitDiffContent } from './index'
```

Then change:

```ts
      gitBranch: (cwd: string) => Promise<string | null>
```

to:

```ts
      gitBranch: (cwd: string) => Promise<string | null>
      gitStatus: (cwd: string) => Promise<GitStatus>
      gitStage: (cwd: string, paths: string[]) => Promise<void>
      gitUnstage: (cwd: string, paths: string[]) => Promise<void>
      gitStageAll: (cwd: string) => Promise<void>
      gitUnstageAll: (cwd: string) => Promise<void>
      gitCommit: (cwd: string, message: string) => Promise<GitCommitResult>
      gitDiff: (cwd: string, path: string, staged: boolean) => Promise<GitDiffContent>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no output (clean). This is the deliverable check for this task — it's pure wiring/types with no runtime logic of its own, verified by the compiler the same way `window.api.gitBranch` already is today.

- [ ] **Step 5: Commit**

```bash
git add electron/preload.ts src/types/index.ts src/types/api.d.ts
git commit -m "$(cat <<'EOF'
feat: expose git status/stage/commit/diff over the preload bridge

Adds window.api.gitStatus/gitStage/gitUnstage/gitStageAll/gitUnstageAll/
gitCommit/gitDiff and their renderer-side types, so the store layer can
consume the electron/git.ts handlers added in the previous commit.
EOF
)"
```

---

### Task 3: `gitStore.ts` status/stage/commit state

**Files:**
- Modify: `src/stores/gitStore.ts`
- Create: `src/stores/__tests__/gitStore.test.ts`

**Interfaces:**
- Consumes: `window.api.gitBranch/gitStatus/gitStage/gitUnstage/gitStageAll/gitUnstageAll/gitCommit` from Task 2; `GitStatus` type from Task 2.
- Produces: `useGitStore` with state `{ branch: string | null; status: GitStatus; commitMessage: string; commitError: string | null }` and actions `refresh(cwd)`, `refreshStatus(cwd)`, `stage(cwd, path)`, `unstage(cwd, path)`, `stageAll(cwd)`, `unstageAll(cwd)`, `setCommitMessage(message)`, `commit(cwd)` — for Task 6 (`GitPanel.tsx`) to consume.

- [ ] **Step 1: Write the failing tests**

Create `src/stores/__tests__/gitStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGitStore } from '../gitStore'
import type { GitStatus } from '@/types/index'

const emptyStatus: GitStatus = { staged: [], unstaged: [] }
const mockStatus: GitStatus = {
  staged: [{ path: 'a.ts', status: 'M' }],
  unstaged: [{ path: 'b.ts', status: '?' }],
}

vi.stubGlobal('window', {
  api: {
    gitBranch: vi.fn().mockResolvedValue('main'),
    gitStatus: vi.fn().mockResolvedValue(mockStatus),
    gitStage: vi.fn().mockResolvedValue(undefined),
    gitUnstage: vi.fn().mockResolvedValue(undefined),
    gitStageAll: vi.fn().mockResolvedValue(undefined),
    gitUnstageAll: vi.fn().mockResolvedValue(undefined),
    gitCommit: vi.fn().mockResolvedValue({ ok: true }),
  },
})

describe('gitStore', () => {
  beforeEach(() =>
    useGitStore.setState({
      branch: null,
      status: emptyStatus,
      commitMessage: '',
      commitError: null,
    })
  )

  it('starts empty', () => {
    const { branch, status, commitMessage, commitError } = useGitStore.getState()
    expect(branch).toBeNull()
    expect(status).toEqual(emptyStatus)
    expect(commitMessage).toBe('')
    expect(commitError).toBeNull()
  })

  it('refresh loads branch and status', async () => {
    await useGitStore.getState().refresh('/proj')
    const { branch, status } = useGitStore.getState()
    expect(branch).toBe('main')
    expect(status).toEqual(mockStatus)
  })

  it('refresh with null cwd clears branch and status', async () => {
    useGitStore.setState({ branch: 'main', status: mockStatus })
    await useGitStore.getState().refresh(null)
    const { branch, status } = useGitStore.getState()
    expect(branch).toBeNull()
    expect(status).toEqual(emptyStatus)
  })

  it('stage calls gitStage with the path and refreshes status', async () => {
    await useGitStore.getState().stage('/proj', 'a.ts')
    expect(window.api.gitStage).toHaveBeenCalledWith('/proj', ['a.ts'])
    expect(useGitStore.getState().status).toEqual(mockStatus)
  })

  it('unstage calls gitUnstage with the path and refreshes status', async () => {
    await useGitStore.getState().unstage('/proj', 'b.ts')
    expect(window.api.gitUnstage).toHaveBeenCalledWith('/proj', ['b.ts'])
  })

  it('stageAll calls gitStageAll and refreshes status', async () => {
    await useGitStore.getState().stageAll('/proj')
    expect(window.api.gitStageAll).toHaveBeenCalledWith('/proj')
  })

  it('unstageAll calls gitUnstageAll and refreshes status', async () => {
    await useGitStore.getState().unstageAll('/proj')
    expect(window.api.gitUnstageAll).toHaveBeenCalledWith('/proj')
  })

  it('setCommitMessage updates the message and clears any error', () => {
    useGitStore.setState({ commitError: 'boom' })
    useGitStore.getState().setCommitMessage('fix bug')
    const { commitMessage, commitError } = useGitStore.getState()
    expect(commitMessage).toBe('fix bug')
    expect(commitError).toBeNull()
  })

  it('commit clears the message and refreshes on success', async () => {
    useGitStore.setState({ commitMessage: 'fix bug' })
    await useGitStore.getState().commit('/proj')
    expect(window.api.gitCommit).toHaveBeenCalledWith('/proj', 'fix bug')
    const { commitMessage, commitError, status } = useGitStore.getState()
    expect(commitMessage).toBe('')
    expect(commitError).toBeNull()
    expect(status).toEqual(mockStatus)
  })

  it('commit sets commitError and keeps the message on failure', async () => {
    vi.mocked(window.api.gitCommit).mockResolvedValueOnce({ ok: false, error: 'nothing staged' })
    useGitStore.setState({ commitMessage: 'fix bug' })
    await useGitStore.getState().commit('/proj')
    const { commitMessage, commitError } = useGitStore.getState()
    expect(commitMessage).toBe('fix bug')
    expect(commitError).toBe('nothing staged')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/stores/__tests__/gitStore.test.ts`
Expected: FAIL — `status`/`commitMessage`/`commitError`/`refreshStatus`/`stage`/`unstage`/`stageAll`/`unstageAll`/`setCommitMessage`/`commit` are undefined on the current store.

- [ ] **Step 3: Rewrite `src/stores/gitStore.ts`**

```ts
import { create } from 'zustand'
import type { GitStatus } from '@/types/index'

interface GitStore {
  branch: string | null
  status: GitStatus
  commitMessage: string
  commitError: string | null
  refresh: (cwd: string | null) => Promise<void>
  refreshStatus: (cwd: string | null) => Promise<void>
  stage: (cwd: string, path: string) => Promise<void>
  unstage: (cwd: string, path: string) => Promise<void>
  stageAll: (cwd: string) => Promise<void>
  unstageAll: (cwd: string) => Promise<void>
  setCommitMessage: (message: string) => void
  commit: (cwd: string) => Promise<void>
}

export const useGitStore = create<GitStore>((set, get) => ({
  branch: null,
  status: { staged: [], unstaged: [] },
  commitMessage: '',
  commitError: null,

  refresh: async (cwd) => {
    if (!cwd) {
      set({ branch: null, status: { staged: [], unstaged: [] } })
      return
    }
    const branch = await window.api.gitBranch(cwd)
    set({ branch })
    await get().refreshStatus(cwd)
  },

  refreshStatus: async (cwd) => {
    if (!cwd) {
      set({ status: { staged: [], unstaged: [] } })
      return
    }
    const status = await window.api.gitStatus(cwd)
    set({ status })
  },

  stage: async (cwd, path) => {
    await window.api.gitStage(cwd, [path])
    await get().refreshStatus(cwd)
  },

  unstage: async (cwd, path) => {
    await window.api.gitUnstage(cwd, [path])
    await get().refreshStatus(cwd)
  },

  stageAll: async (cwd) => {
    await window.api.gitStageAll(cwd)
    await get().refreshStatus(cwd)
  },

  unstageAll: async (cwd) => {
    await window.api.gitUnstageAll(cwd)
    await get().refreshStatus(cwd)
  },

  setCommitMessage: (message) => set({ commitMessage: message, commitError: null }),

  commit: async (cwd) => {
    const { commitMessage } = get()
    const result = await window.api.gitCommit(cwd, commitMessage)
    if (result.ok) {
      set({ commitMessage: '', commitError: null })
      await get().refresh(cwd)
    } else {
      set({ commitError: result.error })
    }
  },
}))
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/stores/__tests__/gitStore.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Type-check and confirm `StatusBar.tsx` still compiles against the extended store**

Run: `npx tsc --noEmit`
Expected: no output (clean) — `StatusBar.tsx` only reads `branch` and calls `refresh`, both still present with the same signatures, so it needs no changes.

- [ ] **Step 6: Commit**

```bash
git add src/stores/gitStore.ts src/stores/__tests__/gitStore.test.ts
git commit -m "$(cat <<'EOF'
feat: add status/stage/unstage/commit state to gitStore

Extends the store beyond just the current branch with staged/unstaged
file lists and commit message/error state, all backed by the IPC
bridge added in the previous commit.
EOF
)"
```

---

### Task 4: Git diff virtual-tab path helpers

**Files:**
- Create: `src/components/Git/paths.ts`
- Create: `src/components/Git/__tests__/paths.test.ts`
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isGitDiffTab(path: string): boolean`, `buildGitDiffPath(filePath: string, staged: boolean): string`, `parseGitDiffPath(tabPath: string): { path: string; staged: boolean }` — for Task 5 (`Editor.tsx`) and Task 6 (`GitPanel.tsx`) to consume.

- [ ] **Step 1: Extend the Vitest include glob so component-level unit tests run**

In `vitest.config.ts`, change:

```ts
    include: ['src/stores/__tests__/**/*.test.ts', 'electron/__tests__/**/*.test.ts']
```

to:

```ts
    include: [
      'src/stores/__tests__/**/*.test.ts',
      'src/components/**/__tests__/**/*.test.ts',
      'electron/__tests__/**/*.test.ts'
    ]
```

- [ ] **Step 2: Write the failing tests**

Create `src/components/Git/__tests__/paths.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isGitDiffTab, buildGitDiffPath, parseGitDiffPath } from '../paths'

describe('git diff virtual tab paths', () => {
  it('builds a staged diff path', () => {
    expect(buildGitDiffPath('/proj/src/foo.ts', true)).toBe(
      'git-diff://staged//proj/src/foo.ts'
    )
  })

  it('builds an unstaged diff path', () => {
    expect(buildGitDiffPath('/proj/src/foo.ts', false)).toBe(
      'git-diff://unstaged//proj/src/foo.ts'
    )
  })

  it('recognizes staged and unstaged diff tabs', () => {
    expect(isGitDiffTab('git-diff://staged//proj/src/foo.ts')).toBe(true)
    expect(isGitDiffTab('git-diff://unstaged//proj/src/foo.ts')).toBe(true)
  })

  it('does not treat regular file paths or settings tabs as diff tabs', () => {
    expect(isGitDiffTab('/proj/src/foo.ts')).toBe(false)
    expect(isGitDiffTab('settings://Display')).toBe(false)
  })

  it('parses a staged diff path back into the real path and staged flag', () => {
    expect(parseGitDiffPath('git-diff://staged//proj/src/foo.ts')).toEqual({
      path: '/proj/src/foo.ts',
      staged: true,
    })
  })

  it('parses an unstaged diff path back into the real path and staged flag', () => {
    expect(parseGitDiffPath('git-diff://unstaged//proj/src/foo.ts')).toEqual({
      path: '/proj/src/foo.ts',
      staged: false,
    })
  })

  it('round-trips build -> parse', () => {
    const built = buildGitDiffPath('/proj/src/foo.ts', true)
    expect(parseGitDiffPath(built)).toEqual({ path: '/proj/src/foo.ts', staged: true })
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/Git/__tests__/paths.test.ts`
Expected: FAIL — `Cannot find module '../paths'` (the file doesn't exist yet).

- [ ] **Step 4: Write `src/components/Git/paths.ts`**

```ts
const STAGED_PREFIX = 'git-diff://staged/'
const UNSTAGED_PREFIX = 'git-diff://unstaged/'

export function isGitDiffTab(path: string): boolean {
  return path.startsWith(STAGED_PREFIX) || path.startsWith(UNSTAGED_PREFIX)
}

export function buildGitDiffPath(filePath: string, staged: boolean): string {
  return (staged ? STAGED_PREFIX : UNSTAGED_PREFIX) + filePath
}

export function parseGitDiffPath(tabPath: string): { path: string; staged: boolean } {
  if (tabPath.startsWith(STAGED_PREFIX)) {
    return { path: tabPath.slice(STAGED_PREFIX.length), staged: true }
  }
  return { path: tabPath.slice(UNSTAGED_PREFIX.length), staged: false }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/Git/__tests__/paths.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Run the full suite to confirm the widened include glob didn't pick up anything unexpected**

Run: `npx vitest run`
Expected: same test files as before plus `src/components/Git/__tests__/paths.test.ts`; still only the pre-existing `fileStore.test.ts` `localStorage` failure.

- [ ] **Step 7: Commit**

```bash
git add src/components/Git/paths.ts src/components/Git/__tests__/paths.test.ts vitest.config.ts
git commit -m "$(cat <<'EOF'
feat: add git-diff:// virtual tab path helpers

Pure build/parse/detect functions for the git-diff://staged|unstaged/
tab convention, parallel to the existing settings:// virtual tabs, so
Editor.tsx and GitPanel.tsx can open and recognize diff tabs.
EOF
)"
```

---

### Task 5: Diff tab rendering in `Editor.tsx`

**Files:**
- Modify: `src/components/Editor/Editor.tsx`

**Interfaces:**
- Consumes: `isGitDiffTab`, `parseGitDiffPath` from Task 4; `window.api.gitDiff` from Task 2; `GitDiffContent` type from Task 2; `useFileStore` (existing, for `projectRoot`).
- Produces: nothing new for later tasks — this is a leaf integration; Task 6 opens tabs whose paths this task knows how to render.

- [ ] **Step 1: Read the current file**

`src/components/Editor/Editor.tsx` is already fully known from earlier exploration — no read needed, shown in full below for the edit.

- [ ] **Step 2: Rewrite `src/components/Editor/Editor.tsx`**

Replace the full file contents with:

```tsx
import { useEffect, useState } from 'react'
import MonacoEditor, { DiffEditor } from '@monaco-editor/react'
import { useEditorStore } from '@/stores/editorStore'
import { useThemeStore, MONACO_THEMES } from '@/stores/themeStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useDisplayStore } from '@/stores/displayStore'
import { useFileStore } from '@/stores/fileStore'
import { TabBar } from './TabBar'
import { detectLang } from './utils'
import { isSettingsTab } from '@/components/Settings/paths'
import { DisplayPage } from '@/components/Settings/DisplayPage'
import { isGitDiffTab, parseGitDiffPath } from '@/components/Git/paths'
import type { GitDiffContent } from '@/types/index'

export function Editor() {
  const { tabs, activeTabPath, updateContent } = useEditorStore()
  const activeTab = tabs.find((t) => t.path === activeTabPath)
  const isVirtual = !!activeTab && isSettingsTab(activeTab.path)
  const isDiff = !!activeTab && isGitDiffTab(activeTab.path)
  const monacoTheme = useThemeStore((s) => MONACO_THEMES[s.theme])
  const fontSize = useFontSizeStore((s) => s.fontSize)
  const font = useDisplayStore((s) => s.font)
  const projectRoot = useFileStore((s) => s.projectRoot)
  const [diffContent, setDiffContent] = useState<GitDiffContent | null>(null)

  useEffect(() => {
    if (!activeTab || !isDiff || !projectRoot) {
      setDiffContent(null)
      return
    }
    const { path, staged } = parseGitDiffPath(activeTab.path)
    let cancelled = false
    window.api.gitDiff(projectRoot, path, staged).then((content) => {
      if (!cancelled) setDiffContent(content)
    })
    return () => {
      cancelled = true
    }
  }, [activeTab?.path, isDiff, projectRoot])

  useEffect(() => {
    if (!activeTab || isVirtual || isDiff) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        window.api.writeFile(activeTab.path, activeTab.content)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab, isVirtual, isDiff])

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      <TabBar />
      {activeTab ? (
        isVirtual ? (
          <DisplayPage />
        ) : isDiff ? (
          <div className="flex-1 overflow-hidden">
            {diffContent && (
              <DiffEditor
                key={activeTab.path}
                original={diffContent.original}
                modified={diffContent.modified}
                language={detectLang(activeTab.path)}
                theme={monacoTheme}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  fontSize,
                  fontFamily: font,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              key={activeTab.path}
              value={activeTab.content}
              language={detectLang(activeTab.path)}
              theme={monacoTheme}
              options={{
                fontSize,
                fontFamily: font,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                padding: { top: 8 },
                automaticLayout: true,
              }}
              onChange={(val) => updateContent(activeTab.path, val ?? '')}
            />
          </div>
        )
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-fg-subtle text-sm">Open a file to start editing</p>
        </div>
      )}
    </div>
  )
}
```

Note: `detectLang` already extracts the extension via `path.split('/').pop()`, so passing the raw `git-diff://staged//proj/src/foo.ts` tab path still resolves to `foo.ts` → correct language, without needing to parse the real path out first. Same trick `TabBar.tsx` already relies on for its tab label.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add src/components/Editor/Editor.tsx
git commit -m "$(cat <<'EOF'
feat: render git-diff:// tabs as a read-only Monaco DiffEditor

Editor.tsx now recognizes the git-diff:// virtual tab convention,
fetches before/after file content via window.api.gitDiff, and renders
it with the same theme/font/size settings as the normal editor. The
Cmd+S save guard is extended to skip diff tabs the same way it already
skips settings:// tabs.
EOF
)"
```

---

### Task 6: `FileRow.tsx` and the `GitPanel.tsx` staging UI

**Files:**
- Create: `src/components/Git/FileRow.tsx`
- Modify: `src/components/Git/GitPanel.tsx`

**Interfaces:**
- Consumes: `useGitStore` (Task 3), `useFileStore` (existing), `useEditorStore.openTab` (existing), `buildGitDiffPath` (Task 4), `GitFileEntry` type (Task 2).
- Produces: the finished, manually-testable feature — nothing further consumes this.

- [ ] **Step 1: Write `src/components/Git/FileRow.tsx`**

```tsx
import type { GitFileEntry } from '@/types/index'

const STATUS_COLOR: Record<GitFileEntry['status'], string> = {
  M: 'text-amber-400',
  A: 'text-green-400',
  D: 'text-red-400',
  R: 'text-blue-400',
  '?': 'text-fg-subtle',
}

interface FileRowProps {
  file: GitFileEntry
  staged: boolean
  onToggle: () => void
  onOpenDiff: () => void
}

export function FileRow({ file, staged, onToggle, onOpenDiff }: FileRowProps) {
  const name = file.path.split('/').pop() ?? file.path

  return (
    <div className="group flex items-center gap-1.5 px-3 py-0.5 rounded hover:bg-white/5">
      <button
        type="button"
        onClick={onOpenDiff}
        title={file.path}
        className="flex items-center gap-1.5 flex-1 min-w-0 text-left text-sm"
      >
        <span className={`w-3 shrink-0 text-xs font-semibold ${STATUS_COLOR[file.status]}`}>
          {file.status}
        </span>
        <span className="truncate text-fg">{name}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        aria-label={staged ? 'Unstage' : 'Stage'}
        className="shrink-0 w-4 h-4 flex items-center justify-center text-fg-muted opacity-0 transition-opacity hover:text-fg group-hover:opacity-100"
      >
        {staged ? '−' : '+'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `src/components/Git/GitPanel.tsx`**

```tsx
import { useEffect } from 'react'
import { useFileStore } from '@/stores/fileStore'
import { useGitStore } from '@/stores/gitStore'
import { useEditorStore } from '@/stores/editorStore'
import { buildGitDiffPath } from './paths'
import { FileRow } from './FileRow'

const pillButtonClass =
  'group w-full h-7 rounded-full flex items-center justify-center text-[10px] font-bold tracking-tight bg-gradient-to-br from-accent/25 to-accent/5 text-accent ring-1 ring-accent/30 shadow-sm shadow-black/20 transition-all duration-150 hover:ring-accent/60 hover:from-accent/35 hover:to-accent/10 hover:scale-105 active:scale-95'

export function GitPanel() {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const {
    status,
    commitMessage,
    commitError,
    refreshStatus,
    stage,
    unstage,
    stageAll,
    unstageAll,
    setCommitMessage,
    commit,
  } = useGitStore()
  const openTab = useEditorStore((s) => s.openTab)

  useEffect(() => {
    refreshStatus(projectRoot)
  }, [projectRoot, refreshStatus])

  const hasChanges = status.staged.length > 0 || status.unstaged.length > 0

  function openDiff(path: string, staged: boolean) {
    openTab({ path: buildGitDiffPath(path, staged), content: '', dirty: false })
  }

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Git Panel
        </span>
      </div>

      <div className="px-3 py-2 border-b border-border shrink-0 flex flex-col gap-1.5">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Message"
          rows={3}
          className="w-full resize-none rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
        {commitError && <p className="text-xs text-red-400">{commitError}</p>}
        <button
          type="button"
          disabled={!commitMessage.trim() || status.staged.length === 0}
          onClick={() => projectRoot && commit(projectRoot)}
          className="w-full h-7 rounded-full flex items-center justify-center text-xs font-semibold bg-accent/80 text-bg transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Commit
        </button>
      </div>

      {hasChanges ? (
        <div className="flex-1 overflow-y-auto py-1">
          {status.staged.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                  Staged Changes ({status.staged.length})
                </span>
                <button
                  type="button"
                  onClick={() => projectRoot && unstageAll(projectRoot)}
                  className="text-[11px] text-fg-muted transition-colors hover:text-fg"
                >
                  Unstage All
                </button>
              </div>
              {status.staged.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  staged
                  onToggle={() => projectRoot && unstage(projectRoot, file.path)}
                  onOpenDiff={() => openDiff(file.path, true)}
                />
              ))}
            </div>
          )}
          {status.unstaged.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                  Changes ({status.unstaged.length})
                </span>
                <button
                  type="button"
                  onClick={() => projectRoot && stageAll(projectRoot)}
                  className="text-[11px] text-fg-muted transition-colors hover:text-fg"
                >
                  Stage All
                </button>
              </div>
              {status.unstaged.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  staged={false}
                  onToggle={() => projectRoot && stage(projectRoot, file.path)}
                  onOpenDiff={() => openDiff(file.path, false)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-fg-subtle">No changes</p>
        </div>
      )}

      <div className="border-t border-border shrink-0 px-3 py-2 flex flex-col gap-1.5">
        <button type="button" className={pillButtonClass} aria-label="Graph (not yet implemented)">
          Graph
        </button>
        <button type="button" className={pillButtonClass} aria-label="List Diff (not yet implemented)">
          List Diff
        </button>
        <button type="button" className={pillButtonClass} aria-label="GG (not yet implemented)">
          GG
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: same result as Task 4 Step 6 — only the pre-existing `fileStore.test.ts` `localStorage` failure, nothing new broken.

- [ ] **Step 5: Manual verification**

Using the `run` skill (launch the Electron app):
1. Open a real git repo with a mix of staged, unstaged, and untracked changes (e.g. this repo mid-edit works).
2. Open the Git Panel — confirm both "Staged Changes" and "Changes" sections list the right files with correct status letters.
3. Click `+` on an unstaged file — confirm it moves to Staged Changes and `git status` on the CLI agrees.
4. Click `−` on a staged file — confirm it moves back.
5. Click "Stage All" / "Unstage All" — confirm both lists update correctly.
6. Click a file row in each section — confirm a diff tab opens showing the correct before/after content, read-only.
7. Type a commit message with at least one file staged, click Commit — confirm the commit lands (`git log -1`), the staged list clears, and the message box empties.
8. With nothing staged or an empty message, confirm the Commit button is disabled.
9. With a clean repo (no changes), confirm the "No changes" empty state still shows.

- [ ] **Step 6: Commit**

```bash
git add src/components/Git/FileRow.tsx src/components/Git/GitPanel.tsx
git commit -m "$(cat <<'EOF'
feat: implement VSCode-style stage/unstage/commit UI in the Git Panel

Replaces the static placeholder with live staged/unstaged file lists,
per-file and stage-all/unstage-all actions, a commit message box wired
to gitStore, and click-to-diff on any file via the git-diff:// tabs
added in the previous two commits.
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** IPC surface (Task 1/2), store state (Task 3), diff tab convention (Task 4), diff rendering (Task 5), staged/unstaged UI + commit box + click-to-diff (Task 6) — all six spec sections have a task. Error handling (commit failure inline text, `git show` failures → empty string) is implemented in Task 1 (`commit`/`showRef`) and surfaced in Task 6 (`commitError` render). Out-of-scope items (hunk staging, discard, Graph/List Diff buttons, merge conflicts, amend) are untouched, matching the spec.
- **Placeholder scan:** no TBD/TODO markers; every step has complete code.
- **Type consistency:** `GitFileEntry`/`GitStatus`/`GitCommitResult`/`GitDiffContent` defined once in `src/types/index.ts` (Task 2) and reused verbatim by Tasks 3, 4, 5, 6 — no renamed duplicates. Store action names (`refreshStatus`, `stage`, `unstage`, `stageAll`, `unstageAll`, `setCommitMessage`, `commit`) match between the Task 3 interface declaration, the Task 3 implementation, and Task 6's usage.
