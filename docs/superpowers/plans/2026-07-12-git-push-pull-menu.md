# Git Push/Pull Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Push, Pull, Fetch, Force Push, and Force Push with Lease via a right-click footer menu, with a confirming modal (optional countdown) for force actions, configurable via a new Git settings page, with live output streaming to a reused Git Log tab.

**Architecture:** The backend spawns `git` via `child_process.spawn` (not `execFileAsync`) and streams stdout/stderr live to the renderer via `git:log:data` IPC events, completing with `git:log:exit`. The renderer accumulates output in a `gitLogStore` shown in a single reused `git-log://Git Log` editor tab. Force-push safety (modal + countdown) is driven by `gitSettingsStore` backed by `localStorage`.

**Tech Stack:** Electron (main process IPC, `child_process.spawn`), React + Zustand (renderer stores/UI), Tailwind CSS, Vitest (tests).

## Global Constraints

- Follow the `localStorage`-based persistence pattern from `displayStore.ts` — no zustand `persist` middleware.
- All IPC handlers registered in `electron/git.ts` via `registerGitHandlers()` (already wired in `electron/main.ts:72`).
- New IPC that needs `BrowserWindow` access (to send events back) uses the class pattern from `electron/claude.ts` — export a class with `registerHandlers(win)`.
- New tab paths follow the scheme in `src/components/Settings/paths.ts` (`settings://`) and `src/components/Git/paths.ts` (`git-diff://`).
- Settings page styled to match `DisplayPage.tsx` — sectioned cards with `rounded-xl border border-border/60 p-4` layout.
- No `--force` with explicit refspecs, no remote/branch selection UI — commands always use the branch's configured upstream.
- One git command runs at a time; the backend has a defensive overlap guard, and the UI disables items while `commandStatus === 'running'`.
- Test files: `electron/__tests__/git.test.ts` (extend), `src/stores/__tests__/gitStore.test.ts` (extend), new `src/stores/__tests__/gitSettingsStore.test.ts`, new `src/components/__tests__/ConfirmForcePushModal.test.tsx`.

---

## File Map

**New files:**
- `electron/gitRunner.ts` — `GitRunner` class: `child_process.spawn`-based command runner, IPC handler registration, overlap guard
- `src/stores/gitLogStore.ts` — accumulated log text, `append(chunk)`
- `src/stores/gitSettingsStore.ts` — force safety settings, localStorage persistence
- `src/stores/__tests__/gitSettingsStore.test.ts` — gitSettingsStore unit tests
- `src/components/Git/GitLogView.tsx` — read-only auto-scrolling log view for `git-log://Git Log`
- `src/components/Git/GitActionsMenu.tsx` — right-click dropdown with 5 git actions
- `src/components/ui/Modal.tsx` — generic dimmed-backdrop modal primitive
- `src/components/Git/ConfirmForcePushModal.tsx` — force-push confirm modal with countdown
- `src/components/__tests__/ConfirmForcePushModal.test.tsx` — modal countdown tests
- `src/components/Settings/GitSettingsPage.tsx` — Git settings page UI
- `src/components/Settings/GitSettingsPage.test.tsx` — settings toggles tests (optional, covered by store tests)

**Modified files:**
- `electron/git.ts` — remove `registerGitHandlers` export (move to `gitRunner.ts`); keep all pure functions unchanged; add `GitCommandAction` type
- `electron/main.ts` — swap `registerGitHandlers()` for `new GitRunner(win).registerHandlers()`
- `electron/__tests__/git.test.ts` — extend with `GitRunner` streaming tests
- `src/types/index.ts` — add `GitCommandAction` type
- `src/types/api.d.ts` — add `gitRunCommand`, `onGitLogData`, `onGitLogExit` to `Window.api`
- `electron/preload.ts` — expose the three new IPC calls
- `src/stores/gitStore.ts` — add `commandStatus`, five new actions (`fetch`, `pull`, `push`, `forcePush`, `forcePushLease`)
- `src/stores/__tests__/gitStore.test.ts` — extend with new action tests
- `src/components/Settings/paths.ts` — add `GIT_SETTINGS_TAB_PATH` and `GIT_LOG_TAB_PATH`
- `src/components/Settings/SettingsPanel.tsx` — add Git nav item
- `src/components/Editor/Editor.tsx` — add `isGitLog` branch to render `GitLogView`
- `src/components/StatusBar/StatusBar.tsx` — right-click opens `GitActionsMenu`; spinner while running

---

### Task 1: `GitCommandAction` type + `GitRunner` backend (streaming IPC)

**Files:**
- Modify: `electron/git.ts` — add `GitCommandAction` type, remove `registerGitHandlers` export
- Create: `electron/gitRunner.ts` — `GitRunner` class with streaming spawn + IPC
- Modify: `electron/main.ts` — wire `GitRunner` instead of bare `registerGitHandlers`
- Modify: `src/types/index.ts` — add `GitCommandAction`
- Test: `electron/__tests__/git.test.ts` — extend with GitRunner tests

**Interfaces:**
- Produces: `GitCommandAction = 'fetch' | 'pull' | 'push' | 'forcePush' | 'forcePushLease'`
- Produces: IPC channels `git:runCommand(id, cwd, action)`, emits `git:log:data { id, data }`, `git:log:exit { id, code }`
- Produces: all existing `git:*` handlers remain registered (now via `GitRunner.registerHandlers`)

- [ ] **Step 1: Add `GitCommandAction` type to `src/types/index.ts`**

Add at the end of the file:

```ts
export type GitCommandAction = 'fetch' | 'pull' | 'push' | 'forcePush' | 'forcePushLease'
```

- [ ] **Step 2: Write the failing tests for `GitRunner` in `electron/__tests__/git.test.ts`**

Add below the existing `parsePorcelainStatus` describe block. The test mocks `child_process` and `electron`, captures the `git:runCommand` handler, invokes it, and simulates stdout/stderr/close events:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChildProcess } from 'child_process'
import type { GitCommandAction } from '../../src/types/index'

// existing vi.mock('electron', ...) stays at the top of the file — add 'child_process' mock:

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))

vi.mock('child_process', () => ({ spawn: (...a: unknown[]) => spawnMock(...a) }))

function fakeProc() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
  return {
    stdout: { on: vi.fn((ev, cb) => { (listeners[`stdout:${ev}`] ??= []).push(cb) }) },
    stderr: { on: vi.fn((ev, cb) => { (listeners[`stderr:${ev}`] ??= []).push(cb) }) },
    on: vi.fn((ev, cb) => { (listeners[ev] ??= []).push(cb) }),
    emit(channel: string, ...args: unknown[]) { listeners[channel]?.forEach(cb => cb(...args)) },
    emitStdout(data: string) { listeners['stdout:data']?.forEach(cb => cb(data)) },
    emitStderr(data: string) { listeners['stderr:data']?.forEach(cb => cb(data)) },
    emitClose(code: number) { listeners['close']?.forEach(cb => cb(code)) },
    kill: vi.fn(),
  }
}

describe('GitRunner', () => {
  let handlers: Record<string, (...args: unknown[]) => unknown>
  let sends: { channel: string; args: unknown[] }[]
  let win: { webContents: { send: (...a: unknown[]) => void } }

  beforeEach(async () => {
    handlers = {}
    sends = []
    spawnMock.mockReset()
    win = { webContents: { send: (...a) => sends.push({ channel: a[0] as string, args: a.slice(1) }) } }
    // Re-import GitRunner fresh each test by clearing the module cache
    vi.resetModules()
    const { GitRunner } = await import('../gitRunner')
    new GitRunner(win as any).registerHandlers()
  })

  it('spawns git with correct args for push', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await handlers['git:runCommand']({}, 'run-1', '/proj', 'push' as GitCommandAction)
    expect(spawnMock).toHaveBeenCalledWith('git', ['push'], expect.objectContaining({ cwd: '/proj' }))
  })

  it('spawns git with --force for forcePush', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await handlers['git:runCommand']({}, 'run-2', '/proj', 'forcePush' as GitCommandAction)
    expect(spawnMock).toHaveBeenCalledWith('git', ['push', '--force'], expect.objectContaining({ cwd: '/proj' }))
  })

  it('spawns git with --force-with-lease for forcePushLease', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await handlers['git:runCommand']({}, 'run-3', '/proj', 'forcePushLease' as GitCommandAction)
    expect(spawnMock).toHaveBeenCalledWith('git', ['push', '--force-with-lease'], expect.anything())
  })

  it('streams stdout as git:log:data events with the correct id', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await handlers['git:runCommand']({}, 'my-id', '/proj', 'fetch' as GitCommandAction)
    proc.emitStdout('Fetching origin\n')
    expect(sends).toContainEqual({ channel: 'git:log:data', args: ['my-id', 'Fetching origin\n'] })
  })

  it('streams stderr as git:log:data events', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await handlers['git:runCommand']({}, 'my-id', '/proj', 'pull' as GitCommandAction)
    proc.emitStderr('remote: Counting objects\n')
    expect(sends).toContainEqual({ channel: 'git:log:data', args: ['my-id', 'remote: Counting objects\n'] })
  })

  it('sends git:log:exit with the exit code on close', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await handlers['git:runCommand']({}, 'my-id', '/proj', 'push' as GitCommandAction)
    proc.emitClose(0)
    expect(sends).toContainEqual({ channel: 'git:log:exit', args: ['my-id', 0] })
  })

  it('sends a synthetic failing exit if a command is already running', async () => {
    const proc = fakeProc()
    spawnMock.mockReturnValue(proc)
    await handlers['git:runCommand']({}, 'first', '/proj', 'push' as GitCommandAction)
    await handlers['git:runCommand']({}, 'second', '/proj', 'pull' as GitCommandAction)
    const exitEvents = sends.filter(s => s.channel === 'git:log:exit')
    expect(exitEvents).toContainEqual({ channel: 'git:log:exit', args: ['second', 1] })
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run the new tests to confirm they fail**

```bash
npm test -- electron/__tests__/git.test.ts
```

Expected: tests in the new `GitRunner` describe fail with "Cannot find module '../gitRunner'".

- [ ] **Step 4: Create `electron/gitRunner.ts`**

```ts
import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import type { GitCommandAction } from '../src/types/index'
import { getGitBranch, getAheadBehind, getGitStatus, stageFiles, unstageFiles, stageAll, unstageAll, commit, getDiffContent } from './git'

const ARGS: Record<GitCommandAction, string[]> = {
  fetch:           ['fetch'],
  pull:            ['pull'],
  push:            ['push'],
  forcePush:       ['push', '--force'],
  forcePushLease:  ['push', '--force-with-lease'],
}

export class GitRunner {
  private win: BrowserWindow
  private running: boolean = false

  constructor(win: BrowserWindow) {
    this.win = win
  }

  registerHandlers(): void {
    ipcMain.handle('git:runCommand', (_e, id: string, cwd: string, action: GitCommandAction) => {
      if (this.running) {
        this.win.webContents.send('git:log:data', id, 'A git command is already running.\n')
        this.win.webContents.send('git:log:exit', id, 1)
        return
      }

      this.running = true
      const proc = spawn('git', ARGS[action], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })

      proc.stdout.on('data', (chunk: Buffer) => {
        this.win.webContents.send('git:log:data', id, chunk.toString())
      })
      proc.stderr.on('data', (chunk: Buffer) => {
        this.win.webContents.send('git:log:data', id, chunk.toString())
      })
      proc.on('close', (code: number | null) => {
        this.running = false
        this.win.webContents.send('git:log:exit', id, code ?? 1)
      })
    })

    // Re-register all existing git handlers (previously in registerGitHandlers)
    ipcMain.handle('git:branch', (_e, cwd: string) => getGitBranch(cwd))
    ipcMain.handle('git:aheadBehind', (_e, cwd: string) => getAheadBehind(cwd))
    ipcMain.handle('git:status', (_e, cwd: string) => getGitStatus(cwd))
    ipcMain.handle('git:stage', (_e, cwd: string, paths: string[]) => stageFiles(cwd, paths))
    ipcMain.handle('git:unstage', (_e, cwd: string, paths: string[]) => unstageFiles(cwd, paths))
    ipcMain.handle('git:stageAll', (_e, cwd: string) => stageAll(cwd))
    ipcMain.handle('git:unstageAll', (_e, cwd: string) => unstageAll(cwd))
    ipcMain.handle('git:commit', (_e, cwd: string, message: string) => commit(cwd, message))
    ipcMain.handle('git:diff', (_e, cwd: string, path: string, staged: boolean) => getDiffContent(cwd, path, staged))
  }
}
```

- [ ] **Step 5: Remove `registerGitHandlers` from `electron/git.ts`**

Delete lines 158–170 of `electron/git.ts` (the `registerGitHandlers` function and its `import { ipcMain }` at the top):

In `electron/git.ts`, remove:
```ts
import { ipcMain } from 'electron'
```
and remove the entire `registerGitHandlers` function at the bottom.

- [ ] **Step 6: Update `electron/main.ts` to use `GitRunner`**

```ts
// Replace:
import { registerGitHandlers } from './git'
// With:
import { GitRunner } from './gitRunner'

// Replace inside app.whenReady():
registerGitHandlers()
// With:
const gitRunner = new GitRunner(win)
gitRunner.registerHandlers()
```

Note: `createWindow()` must be called before `gitRunner` is constructed since `GitRunner` needs `win`. Reorder slightly:

```ts
app.whenReady().then(() => {
  registerFsHandlers()
  const win = createWindow()
  const gitRunner = new GitRunner(win)
  gitRunner.registerHandlers()
  const ptyMgr = new PtyManager(win)
  ptyMgr.registerHandlers()
  const claudeMgr = new ClaudeManager(win)
  claudeMgr.registerHandlers()
  // ...
})
```

- [ ] **Step 7: Run all tests to confirm they pass**

```bash
npm test
```

Expected: all existing `parsePorcelainStatus` tests pass, all new `GitRunner` tests pass.

- [ ] **Step 8: Commit**

```bash
git add electron/gitRunner.ts electron/git.ts electron/main.ts src/types/index.ts electron/__tests__/git.test.ts
git commit -m "feat: add GitRunner for streaming git command IPC"
```

---

### Task 2: Preload + type declarations for new IPC

**Files:**
- Modify: `electron/preload.ts` — expose `gitRunCommand`, `onGitLogData`, `onGitLogExit`
- Modify: `src/types/api.d.ts` — add the three new methods to `Window.api`

**Interfaces:**
- Consumes: IPC channels from Task 1
- Produces:
  - `window.api.gitRunCommand(id: string, cwd: string, action: GitCommandAction): Promise<void>`
  - `window.api.onGitLogData(cb: (id: string, data: string) => void): () => void`
  - `window.api.onGitLogExit(cb: (id: string, code: number) => void): () => void`

- [ ] **Step 1: Add to `electron/preload.ts`**

Add these three entries inside the `contextBridge.exposeInMainWorld('api', { ... })` object:

```ts
gitRunCommand: (id: string, cwd: string, action: string) =>
  ipcRenderer.invoke('git:runCommand', id, cwd, action),
onGitLogData: (cb: (id: string, data: string) => void) => {
  const handler = (_: Electron.IpcRendererEvent, id: string, data: string) => cb(id, data)
  ipcRenderer.on('git:log:data', handler)
  return () => ipcRenderer.removeListener('git:log:data', handler)
},
onGitLogExit: (cb: (id: string, code: number) => void) => {
  const handler = (_: Electron.IpcRendererEvent, id: string, code: number) => cb(id, code)
  ipcRenderer.on('git:log:exit', handler)
  return () => ipcRenderer.removeListener('git:log:exit', handler)
},
```

- [ ] **Step 2: Update `src/types/api.d.ts`**

Add the import for `GitCommandAction` at the top:

```ts
import type { FileNode, GitStatus, GitCommitResult, GitDiffContent, GitAheadBehind, GitCommandAction } from './index'
```

Add these three entries to the `api` object in the `Window` interface:

```ts
gitRunCommand: (id: string, cwd: string, action: GitCommandAction) => Promise<void>
onGitLogData: (cb: (id: string, data: string) => void) => () => void
onGitLogExit: (cb: (id: string, code: number) => void) => () => void
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add electron/preload.ts src/types/api.d.ts src/types/index.ts
git commit -m "feat: expose gitRunCommand and log IPC events via preload"
```

---

### Task 3: `gitLogStore` + `gitSettingsStore`

**Files:**
- Create: `src/stores/gitLogStore.ts`
- Create: `src/stores/gitSettingsStore.ts`
- Create: `src/stores/__tests__/gitSettingsStore.test.ts`

**Interfaces:**
- Produces:
  - `useGitLogStore` — `{ text: string; append(chunk: string): void }`
  - `useGitSettingsStore` — `{ forceSafetyEnabled: boolean; countdownEnabled: boolean; countdownSeconds: number; autoContinueOnCountdownEnd: boolean; setForceSafetyEnabled(v: boolean): void; setCountdownEnabled(v: boolean): void; setCountdownSeconds(v: number): void; setAutoContinueOnCountdownEnd(v: boolean): void }`

- [ ] **Step 1: Write failing tests for `gitSettingsStore`**

Create `src/stores/__tests__/gitSettingsStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

// localStorage stub
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
})

import { useGitSettingsStore } from '../gitSettingsStore'

describe('gitSettingsStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    useGitSettingsStore.setState({
      forceSafetyEnabled: true,
      countdownEnabled: false,
      countdownSeconds: 5,
      autoContinueOnCountdownEnd: false,
    })
  })

  it('has correct defaults', () => {
    const s = useGitSettingsStore.getState()
    expect(s.forceSafetyEnabled).toBe(true)
    expect(s.countdownEnabled).toBe(false)
    expect(s.countdownSeconds).toBe(5)
    expect(s.autoContinueOnCountdownEnd).toBe(false)
  })

  it('setForceSafetyEnabled persists to localStorage', () => {
    useGitSettingsStore.getState().setForceSafetyEnabled(false)
    expect(useGitSettingsStore.getState().forceSafetyEnabled).toBe(false)
    expect(store['huginn:git:forceSafetyEnabled']).toBe('false')
  })

  it('setCountdownEnabled persists to localStorage', () => {
    useGitSettingsStore.getState().setCountdownEnabled(true)
    expect(useGitSettingsStore.getState().countdownEnabled).toBe(true)
    expect(store['huginn:git:countdownEnabled']).toBe('true')
  })

  it('setCountdownSeconds persists to localStorage', () => {
    useGitSettingsStore.getState().setCountdownSeconds(10)
    expect(useGitSettingsStore.getState().countdownSeconds).toBe(10)
    expect(store['huginn:git:countdownSeconds']).toBe('10')
  })

  it('setAutoContinueOnCountdownEnd persists to localStorage', () => {
    useGitSettingsStore.getState().setAutoContinueOnCountdownEnd(true)
    expect(useGitSettingsStore.getState().autoContinueOnCountdownEnd).toBe(true)
    expect(store['huginn:git:autoContinueOnCountdownEnd']).toBe('true')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- src/stores/__tests__/gitSettingsStore.test.ts
```

Expected: FAIL with "Cannot find module '../gitSettingsStore'".

- [ ] **Step 3: Create `src/stores/gitSettingsStore.ts`**

```ts
import { create } from 'zustand'

const KEYS = {
  forceSafetyEnabled:        'huginn:git:forceSafetyEnabled',
  countdownEnabled:          'huginn:git:countdownEnabled',
  countdownSeconds:          'huginn:git:countdownSeconds',
  autoContinueOnCountdownEnd:'huginn:git:autoContinueOnCountdownEnd',
}

function getBool(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key)
  return v === null ? def : v === 'true'
}

function getInt(key: string, def: number): number {
  const v = localStorage.getItem(key)
  return v === null ? def : parseInt(v, 10)
}

interface GitSettingsStore {
  forceSafetyEnabled: boolean
  countdownEnabled: boolean
  countdownSeconds: number
  autoContinueOnCountdownEnd: boolean
  setForceSafetyEnabled: (v: boolean) => void
  setCountdownEnabled: (v: boolean) => void
  setCountdownSeconds: (v: number) => void
  setAutoContinueOnCountdownEnd: (v: boolean) => void
}

export const useGitSettingsStore = create<GitSettingsStore>((set) => ({
  forceSafetyEnabled:         getBool(KEYS.forceSafetyEnabled, true),
  countdownEnabled:           getBool(KEYS.countdownEnabled, false),
  countdownSeconds:           getInt(KEYS.countdownSeconds, 5),
  autoContinueOnCountdownEnd: getBool(KEYS.autoContinueOnCountdownEnd, false),

  setForceSafetyEnabled: (v) => {
    localStorage.setItem(KEYS.forceSafetyEnabled, String(v))
    set({ forceSafetyEnabled: v })
  },
  setCountdownEnabled: (v) => {
    localStorage.setItem(KEYS.countdownEnabled, String(v))
    set({ countdownEnabled: v })
  },
  setCountdownSeconds: (v) => {
    localStorage.setItem(KEYS.countdownSeconds, String(v))
    set({ countdownSeconds: v })
  },
  setAutoContinueOnCountdownEnd: (v) => {
    localStorage.setItem(KEYS.autoContinueOnCountdownEnd, String(v))
    set({ autoContinueOnCountdownEnd: v })
  },
}))
```

- [ ] **Step 4: Create `src/stores/gitLogStore.ts`**

```ts
import { create } from 'zustand'

interface GitLogStore {
  text: string
  append: (chunk: string) => void
}

export const useGitLogStore = create<GitLogStore>((set) => ({
  text: '',
  append: (chunk) => set((s) => ({ text: s.text + chunk })),
}))
```

- [ ] **Step 5: Run tests**

```bash
npm test -- src/stores/__tests__/gitSettingsStore.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/stores/gitLogStore.ts src/stores/gitSettingsStore.ts src/stores/__tests__/gitSettingsStore.test.ts
git commit -m "feat: add gitLogStore and gitSettingsStore"
```

---

### Task 4: Extend `gitStore` with five new command actions

**Files:**
- Modify: `src/stores/gitStore.ts` — add `commandStatus`, `fetch`, `pull`, `push`, `forcePush`, `forcePushLease`
- Modify: `src/stores/__tests__/gitStore.test.ts` — extend with new action tests

**Interfaces:**
- Consumes: `window.api.gitRunCommand`, `window.api.onGitLogData`, `window.api.onGitLogExit` (from Task 2)
- Consumes: `useGitLogStore.getState().append` (from Task 3)
- Consumes: `useEditorStore.getState().openTab` — to focus the log tab on every command start
- Consumes: `GIT_LOG_TAB_PATH = 'git-log://Git Log'` (from Task 5 paths — define the constant here too, or import from paths once Task 5 creates it; for now inline the string literal)
- Produces: `commandStatus: 'idle' | 'running'` readable by `StatusBar` and `GitActionsMenu`

- [ ] **Step 1: Write failing tests**

Add to `src/stores/__tests__/gitStore.test.ts` — extend the existing `vi.stubGlobal` mock with the new API methods, then add a new describe block:

```ts
// Add to the api mock object in vi.stubGlobal:
gitRunCommand: vi.fn().mockResolvedValue(undefined),
onGitLogData: vi.fn().mockReturnValue(() => {}),
onGitLogExit: vi.fn().mockReturnValue(() => {}),
```

```ts
// New describe block at the bottom of the file:
describe('gitStore — command actions', () => {
  beforeEach(() => {
    useGitStore.setState({
      branch: 'main',
      aheadBehind: null,
      status: emptyStatus,
      commitMessage: '',
      commitError: null,
      commandStatus: 'idle',
    })
    vi.mocked(window.api.gitRunCommand).mockClear()
    vi.mocked(window.api.onGitLogData).mockClear()
    vi.mocked(window.api.onGitLogExit).mockClear()
  })

  it('sets commandStatus to running and calls gitRunCommand for push', async () => {
    const pushPromise = useGitStore.getState().push('/proj')
    expect(useGitStore.getState().commandStatus).toBe('running')
    expect(window.api.gitRunCommand).toHaveBeenCalledWith(
      expect.any(String), '/proj', 'push'
    )
    await pushPromise
  })

  it('does nothing if commandStatus is already running', async () => {
    useGitStore.setState({ commandStatus: 'running' })
    await useGitStore.getState().push('/proj')
    expect(window.api.gitRunCommand).not.toHaveBeenCalled()
  })

  it('calls gitRunCommand with forcePush for forcePush action', async () => {
    await useGitStore.getState().forcePush('/proj')
    expect(window.api.gitRunCommand).toHaveBeenCalledWith(
      expect.any(String), '/proj', 'forcePush'
    )
  })

  it('calls gitRunCommand with forcePushLease for forcePushLease action', async () => {
    await useGitStore.getState().forcePushLease('/proj')
    expect(window.api.gitRunCommand).toHaveBeenCalledWith(
      expect.any(String), '/proj', 'forcePushLease'
    )
  })
})
```

- [ ] **Step 2: Run to confirm failing**

```bash
npm test -- src/stores/__tests__/gitStore.test.ts
```

Expected: new tests fail with "push is not a function" (or similar).

- [ ] **Step 3: Update `src/stores/gitStore.ts`**

Add to the `GitStore` interface:

```ts
commandStatus: 'idle' | 'running'
fetch: (cwd: string) => Promise<void>
pull: (cwd: string) => Promise<void>
push: (cwd: string) => Promise<void>
forcePush: (cwd: string) => Promise<void>
forcePushLease: (cwd: string) => Promise<void>
```

Add to the initial state:

```ts
commandStatus: 'idle' as const,
```

Add this helper inside the `create` call (before the return object), then add the five actions using it:

```ts
const runCommand = async (cwd: string, action: import('@/types/index').GitCommandAction) => {
  if (get().commandStatus === 'running') return
  const id = crypto.randomUUID()

  // Open/focus the git log tab
  const { useEditorStore } = await import('./editorStore')
  useEditorStore.getState().openTab({ path: 'git-log://Git Log', content: '', dirty: false })

  // Append a header line
  const { useGitLogStore } = await import('./gitLogStore')
  useGitLogStore.getState().append(`\n> git ${action === 'forcePush' ? 'push --force' : action === 'forcePushLease' ? 'push --force-with-lease' : action}\n`)

  set({ commandStatus: 'running' })

  const cleanupData = window.api.onGitLogData((evtId, data) => {
    if (evtId !== id) return
    useGitLogStore.getState().append(data)
  })
  const cleanupExit = window.api.onGitLogExit((evtId, code) => {
    if (evtId !== id) return
    cleanupData()
    cleanupExit()
    set({ commandStatus: 'idle' })
    if (code === 0) get().refresh(cwd)
  })

  await window.api.gitRunCommand(id, cwd, action)
}
```

Add the five actions to the store object:

```ts
fetch:          (cwd) => runCommand(cwd, 'fetch'),
pull:           (cwd) => runCommand(cwd, 'pull'),
push:           (cwd) => runCommand(cwd, 'push'),
forcePush:      (cwd) => runCommand(cwd, 'forcePush'),
forcePushLease: (cwd) => runCommand(cwd, 'forcePushLease'),
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/stores/__tests__/gitStore.test.ts
```

Expected: all tests (old and new) pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/gitStore.ts src/stores/__tests__/gitStore.test.ts
git commit -m "feat: add fetch/pull/push/forcePush/forcePushLease actions to gitStore"
```

---

### Task 5: Tab paths + `GitLogView` + wire into `Editor`

**Files:**
- Modify: `src/components/Settings/paths.ts` — add `GIT_LOG_TAB_PATH`, `GIT_SETTINGS_TAB_PATH`
- Create: `src/components/Git/GitLogView.tsx`
- Modify: `src/components/Editor/Editor.tsx` — add `isGitLog` branch
- Modify: `src/components/Editor/TabBar.tsx` — friendly display name for git-log tab

**Interfaces:**
- Consumes: `useGitLogStore` (Task 3)
- Produces: `GIT_LOG_TAB_PATH = 'git-log://Git Log'`, `GIT_SETTINGS_TAB_PATH = 'settings://Git'`

- [ ] **Step 1: Update `src/components/Settings/paths.ts`**

```ts
export const DISPLAY_TAB_PATH = 'settings://Display'
export const GIT_SETTINGS_TAB_PATH = 'settings://Git'
export const GIT_LOG_TAB_PATH = 'git-log://Git Log'

export function isSettingsTab(path: string): boolean {
  return path.startsWith('settings://')
}

export function isGitLogTab(path: string): boolean {
  return path === GIT_LOG_TAB_PATH
}
```

- [ ] **Step 2: Create `src/components/Git/GitLogView.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { useGitLogStore } from '@/stores/gitLogStore'
import { useThemeStore } from '@/stores/themeStore'
import { useDisplayStore } from '@/stores/displayStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'

export function GitLogView() {
  const text = useGitLogStore((s) => s.text)
  const theme = useThemeStore((s) => s.theme)
  const font = useDisplayStore((s) => s.font)
  const fontSize = useFontSizeStore((s) => s.fontSize)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [text])

  const isDark = theme === 'claude-dark' || theme === 'codex-dark'

  return (
    <div
      className="h-full overflow-auto p-4"
      style={{
        background: isDark ? '#1a1a1a' : '#ffffff',
        color: isDark ? '#d4d4d4' : '#1f1f1f',
        fontFamily: font,
        fontSize,
      }}
    >
      <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed m-0">
        {text || 'No git commands run yet.'}
      </pre>
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 3: Update `src/components/Editor/Editor.tsx`**

Add import at the top:

```ts
import { isGitLogTab } from '@/components/Settings/paths'
import { GitLogView } from '@/components/Git/GitLogView'
```

Add the `isGitLog` check alongside the existing `isVirtual`/`isDiff` checks:

```ts
const isGitLog = !!activeTab && isGitLogTab(activeTab.path)
```

Update the render branch (currently `isVirtual ? <DisplayPage/> : isDiff ? <DiffEditor.../> : <MonacoEditor.../>`):

```tsx
isVirtual ? (
  <DisplayPage />
) : isGitLog ? (
  <GitLogView />
) : isDiff ? (
  <div className="flex-1 overflow-hidden">
    {/* ... existing DiffEditor JSX unchanged ... */}
  </div>
) : (
  {/* ... existing MonacoEditor JSX unchanged ... */}
)
```

Also guard the Cmd+S handler to skip `isGitLog` (alongside the existing `isVirtual || isDiff` check):

```ts
if (!activeTab || isVirtual || isDiff || isGitLog) return
```

- [ ] **Step 4: Update `TabBar.tsx` for a friendlier display name**

`TabBar.tsx` currently uses `tab.path.split('/').pop() ?? tab.path` as the tab label. For `git-log://Git Log` this produces `Git Log`, which is fine. No change needed — verify by inspection.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings/paths.ts src/components/Git/GitLogView.tsx src/components/Editor/Editor.tsx
git commit -m "feat: add GitLogView tab for streaming git command output"
```

---

### Task 6: `Modal` primitive + `ConfirmForcePushModal`

**Files:**
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/Git/ConfirmForcePushModal.tsx`
- Create: `src/components/__tests__/ConfirmForcePushModal.test.tsx`

**Interfaces:**
- Consumes: `useGitSettingsStore` (Task 3), `useGitStore.branch`, `useGitStore.forcePush`, `useGitStore.forcePushLease`
- Produces: `<ConfirmForcePushModal action="forcePush"|"forcePushLease" cwd={string} onClose={() => void} />` — mounts when a force action is requested, unmounts on confirm/cancel

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/ConfirmForcePushModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useGitStore } from '@/stores/gitStore'
import { useGitSettingsStore } from '@/stores/gitSettingsStore'

vi.mock('@/stores/gitStore', () => ({
  useGitStore: vi.fn(),
}))
vi.mock('@/stores/gitSettingsStore', () => ({
  useGitSettingsStore: vi.fn(),
}))

function mockGitStore(overrides = {}) {
  vi.mocked(useGitStore).mockImplementation((sel: any) =>
    sel({ branch: 'main', forcePush: vi.fn(), forcePushLease: vi.fn(), ...overrides })
  )
}

function mockSettings(overrides = {}) {
  vi.mocked(useGitSettingsStore).mockImplementation((sel: any) =>
    sel({
      forceSafetyEnabled: true,
      countdownEnabled: false,
      countdownSeconds: 5,
      autoContinueOnCountdownEnd: false,
      ...overrides,
    })
  )
}

import { ConfirmForcePushModal } from '@/components/Git/ConfirmForcePushModal'

describe('ConfirmForcePushModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGitStore()
    mockSettings()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the branch name', () => {
    const onClose = vi.fn()
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={onClose} />)
    expect(screen.getByText(/origin\/main/)).toBeTruthy()
  })

  it('cancel button calls onClose without running command', async () => {
    const forcePush = vi.fn()
    mockGitStore({ forcePush })
    const onClose = vi.fn()
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={onClose} />)
    await userEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(forcePush).not.toHaveBeenCalled()
  })

  it('confirm button calls forcePush and then onClose (no countdown)', async () => {
    const forcePush = vi.fn().mockResolvedValue(undefined)
    mockGitStore({ forcePush })
    const onClose = vi.fn()
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={onClose} />)
    await userEvent.click(screen.getByText('Confirm'))
    expect(forcePush).toHaveBeenCalledWith('/proj')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows countdown ticking down and no Confirm button initially', () => {
    mockSettings({ countdownEnabled: true, countdownSeconds: 3, autoContinueOnCountdownEnd: false })
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={vi.fn()} />)
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.queryByText('Confirm')).toBeNull()
  })

  it('shows Confirm after countdown with autoContinue=false', async () => {
    mockSettings({ countdownEnabled: true, countdownSeconds: 2, autoContinueOnCountdownEnd: false })
    const forcePush = vi.fn().mockResolvedValue(undefined)
    mockGitStore({ forcePush })
    const onClose = vi.fn()
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={onClose} />)
    expect(screen.queryByText('Confirm')).toBeNull()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(await screen.findByText('Confirm')).toBeTruthy()
    expect(forcePush).not.toHaveBeenCalled()
  })

  it('auto-fires and closes when autoContinue=true after countdown', async () => {
    mockSettings({ countdownEnabled: true, countdownSeconds: 2, autoContinueOnCountdownEnd: true })
    const forcePush = vi.fn().mockResolvedValue(undefined)
    mockGitStore({ forcePush })
    const onClose = vi.fn()
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={onClose} />)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(forcePush).toHaveBeenCalledWith('/proj')
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to confirm failing**

```bash
npm test -- src/components/__tests__/ConfirmForcePushModal.test.tsx
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Create `src/components/ui/Modal.tsx`**

```tsx
import { useEffect } from 'react'

interface ModalProps {
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ onClose, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-sidebar border border-border rounded-xl shadow-2xl shadow-black/60 p-6 min-w-[320px] max-w-sm w-full">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/Git/ConfirmForcePushModal.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useGitStore } from '@/stores/gitStore'
import { useGitSettingsStore } from '@/stores/gitSettingsStore'
import type { GitCommandAction } from '@/types/index'

interface Props {
  action: Extract<GitCommandAction, 'forcePush' | 'forcePushLease'>
  cwd: string
  onClose: () => void
}

export function ConfirmForcePushModal({ action, cwd, onClose }: Props) {
  const branch = useGitStore((s) => s.branch)
  const runAction = useGitStore((s) => s[action])
  const { countdownEnabled, countdownSeconds, autoContinueOnCountdownEnd } =
    useGitSettingsStore((s) => ({
      countdownEnabled: s.countdownEnabled,
      countdownSeconds: s.countdownSeconds,
      autoContinueOnCountdownEnd: s.autoContinueOnCountdownEnd,
    }))

  const [remaining, setRemaining] = useState(countdownEnabled ? countdownSeconds : null)
  const [countdownDone, setCountdownDone] = useState(false)

  useEffect(() => {
    if (!countdownEnabled || remaining === null || remaining <= 0) return
    const t = setTimeout(() => {
      const next = remaining - 1
      setRemaining(next)
      if (next <= 0) setCountdownDone(true)
    }, 1000)
    return () => clearTimeout(t)
  }, [countdownEnabled, remaining])

  useEffect(() => {
    if (!countdownDone) return
    if (autoContinueOnCountdownEnd) {
      runAction(cwd).then(onClose)
    }
  }, [countdownDone, autoContinueOnCountdownEnd, runAction, cwd, onClose])

  async function handleConfirm() {
    await runAction(cwd)
    onClose()
  }

  const label = action === 'forcePush' ? 'Force push' : 'Force push with lease'

  return (
    <Modal onClose={onClose}>
      <h2 className="text-sm font-semibold text-fg mb-1">{label}</h2>
      <p className="text-sm text-fg-muted mb-5">
        Push to <span className="font-mono text-fg">origin/{branch ?? '…'}</span>?
        This can overwrite remote history.
      </p>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-sm rounded-lg border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
        >
          Cancel
        </button>
        {!countdownEnabled || countdownDone ? (
          !autoContinueOnCountdownEnd || !countdownEnabled ? (
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-1.5 text-sm rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold transition-colors"
            >
              Confirm
            </button>
          ) : null
        ) : (
          <span className="tabular-nums text-sm text-fg-muted w-8 text-center select-none">
            {remaining}
          </span>
        )}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- src/components/__tests__/ConfirmForcePushModal.test.tsx
```

Expected: all 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Modal.tsx src/components/Git/ConfirmForcePushModal.tsx src/components/__tests__/ConfirmForcePushModal.test.tsx
git commit -m "feat: add Modal primitive and ConfirmForcePushModal with countdown"
```

---

### Task 7: `GitActionsMenu` + wire into `StatusBar`

**Files:**
- Create: `src/components/Git/GitActionsMenu.tsx`
- Modify: `src/components/StatusBar/StatusBar.tsx`

**Interfaces:**
- Consumes: `useGitStore` — `commandStatus`, `fetch`, `pull`, `push`
- Consumes: `useGitSettingsStore` — `forceSafetyEnabled`
- Consumes: `ConfirmForcePushModal` (Task 6)
- Consumes: `useFileStore` — `projectRoot`

- [ ] **Step 1: Create `src/components/Git/GitActionsMenu.tsx`**

```tsx
import { useState } from 'react'
import { useGitStore } from '@/stores/gitStore'
import { useGitSettingsStore } from '@/stores/gitSettingsStore'
import { useFileStore } from '@/stores/fileStore'
import { ConfirmForcePushModal } from './ConfirmForcePushModal'
import type { GitCommandAction } from '@/types/index'

interface Props {
  onClose: () => void
}

type ForceAction = Extract<GitCommandAction, 'forcePush' | 'forcePushLease'>

export function GitActionsMenu({ onClose }: Props) {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const commandStatus = useGitStore((s) => s.commandStatus)
  const { fetch, pull, push } = useGitStore((s) => ({ fetch: s.fetch, pull: s.pull, push: s.push }))
  const forceSafetyEnabled = useGitSettingsStore((s) => s.forceSafetyEnabled)
  const [forceAction, setForceAction] = useState<ForceAction | null>(null)

  const disabled = commandStatus === 'running' || !projectRoot

  async function run(action: () => Promise<void>) {
    onClose()
    await action()
  }

  function handleForce(action: ForceAction) {
    onClose()
    if (!forceSafetyEnabled) {
      const fn = useGitStore.getState()[action]
      if (projectRoot) fn(projectRoot)
    } else {
      setForceAction(action)
    }
  }

  const itemClass =
    'w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <>
      <div className="absolute bottom-full left-0 mb-1 w-48 rounded-lg border border-border bg-sidebar shadow-lg shadow-black/40 py-1 z-50">
        <button type="button" className={itemClass} disabled={disabled}
          onClick={() => run(() => fetch(projectRoot!))}>
          Fetch
        </button>
        <button type="button" className={itemClass} disabled={disabled}
          onClick={() => run(() => pull(projectRoot!))}>
          Pull
        </button>
        <button type="button" className={itemClass} disabled={disabled}
          onClick={() => run(() => push(projectRoot!))}>
          Push
        </button>
        <div className="my-1 border-t border-border" />
        <button type="button" className={`${itemClass} text-red-400`} disabled={disabled}
          onClick={() => handleForce('forcePush')}>
          Force Push
        </button>
        <button type="button" className={`${itemClass} text-red-400`} disabled={disabled}
          onClick={() => handleForce('forcePushLease')}>
          Force Push with Lease
        </button>
      </div>
      {forceAction && projectRoot && (
        <ConfirmForcePushModal
          action={forceAction}
          cwd={projectRoot}
          onClose={() => setForceAction(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Update `src/components/StatusBar/StatusBar.tsx`**

Add imports:

```ts
import { GitActionsMenu } from '@/components/Git/GitActionsMenu'
```

Add state to the component:

```ts
const commandStatus = useGitStore((s) => s.commandStatus)
const [gitMenuOpen, setGitMenuOpen] = useState(false)
```

Wrap the branch `<span>` in a `<div className="relative">` and attach `onContextMenu`:

```tsx
<div className="relative">
  <span
    className="flex items-center gap-1 text-fg-muted text-xs truncate cursor-default select-none"
    onContextMenu={(e) => { e.preventDefault(); setGitMenuOpen((o) => !o) }}
  >
    <GitIcon className="w-3 h-3 shrink-0" />
    {branch}
    {commandStatus === 'running' ? (
      <span className="ml-1.5 text-fg-subtle animate-pulse">●</span>
    ) : (
      aheadBehind && (aheadBehind.behind > 0 || aheadBehind.ahead > 0) && (
        <span className="flex items-center gap-0.5 tabular-nums ml-1.5">
          {aheadBehind.behind > 0 && <span>↓{aheadBehind.behind}</span>}
          {aheadBehind.ahead > 0 && <span>↑{aheadBehind.ahead}</span>}
        </span>
      )
    )}
  </span>
  {gitMenuOpen && (
    <GitActionsMenu onClose={() => setGitMenuOpen(false)} />
  )}
</div>
```

Add the click-outside close (parallel to the existing `menuOpen` listener):

```ts
useEffect(() => {
  if (!gitMenuOpen) return
  const close = () => setGitMenuOpen(false)
  window.addEventListener('click', close)
  return () => window.removeEventListener('click', close)
}, [gitMenuOpen])
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Git/GitActionsMenu.tsx src/components/StatusBar/StatusBar.tsx
git commit -m "feat: add right-click git actions menu to footer with force-push modal"
```

---

### Task 8: Git Settings page

**Files:**
- Create: `src/components/Settings/GitSettingsPage.tsx`
- Modify: `src/components/Settings/SettingsPanel.tsx` — add Git nav item
- Modify: `src/components/Editor/Editor.tsx` — render `GitSettingsPage` for `settings://Git`

**Interfaces:**
- Consumes: `useGitSettingsStore` (Task 3), `GIT_SETTINGS_TAB_PATH` (Task 5)

- [ ] **Step 1: Create `src/components/Settings/GitSettingsPage.tsx`**

```tsx
import { useGitSettingsStore } from '@/stores/gitSettingsStore'

function Toggle({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div>
        <div className="text-sm text-fg">{label}</div>
        <div className="text-xs text-fg-muted mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5',
          checked ? 'bg-accent' : 'bg-fg-subtle/40',
        ].join(' ')}
      >
        <span className={[
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')} />
      </button>
    </label>
  )
}

export function GitSettingsPage() {
  const {
    forceSafetyEnabled, setForceSafetyEnabled,
    countdownEnabled, setCountdownEnabled,
    countdownSeconds, setCountdownSeconds,
    autoContinueOnCountdownEnd, setAutoContinueOnCountdownEnd,
  } = useGitSettingsStore()

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">Git</h1>
      <p className="text-sm text-fg-muted mb-8">Safety settings for destructive git operations.</p>

      <div className="grid grid-cols-1 gap-6 max-w-lg">
        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Force Push Safety</h2>

          <Toggle
            label="Confirm before force-pushing"
            description="Show a confirmation modal before running force push or force push with lease."
            checked={forceSafetyEnabled}
            onChange={setForceSafetyEnabled}
          />

          <div className={forceSafetyEnabled ? '' : 'opacity-40 pointer-events-none'}>
            <Toggle
              label="Countdown before confirming"
              description="Show a countdown timer instead of an immediate Confirm button."
              checked={countdownEnabled}
              onChange={setCountdownEnabled}
            />
          </div>

          {forceSafetyEnabled && countdownEnabled && (
            <div className="flex items-center gap-3 pl-1">
              <label className="text-sm text-fg-muted shrink-0">Countdown duration</label>
              <input
                type="number"
                min={1}
                max={30}
                value={countdownSeconds}
                onChange={(e) => setCountdownSeconds(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))}
                className="w-16 px-2 py-1 text-sm text-fg bg-bg border border-border rounded-lg focus:outline-none focus:border-accent/60"
              />
              <span className="text-sm text-fg-muted">seconds</span>
            </div>
          )}

          {forceSafetyEnabled && countdownEnabled && (
            <div className={countdownEnabled ? '' : 'opacity-40 pointer-events-none'}>
              <Toggle
                label="Continue automatically when countdown ends"
                description="The force push fires when the timer reaches zero, without requiring a Confirm click."
                checked={autoContinueOnCountdownEnd}
                onChange={setAutoContinueOnCountdownEnd}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/components/Settings/SettingsPanel.tsx`**

Add imports and the new nav item:

```tsx
import { DISPLAY_TAB_PATH, GIT_SETTINGS_TAB_PATH } from './paths'

// Inside the component, add active check for Git:
const isGitActive = activeTabPath === GIT_SETTINGS_TAB_PATH

// Add button after the existing "Display" button:
<button
  type="button"
  onClick={() =>
    useEditorStore.getState().openTab({ path: GIT_SETTINGS_TAB_PATH, content: '', dirty: false })
  }
  className={[
    'w-full text-left px-3 py-1.5 text-sm transition-colors',
    isGitActive ? 'bg-accent/10 text-fg' : 'text-fg hover:bg-white/5',
  ].join(' ')}
>
  Git
</button>
```

- [ ] **Step 3: Update `src/components/Editor/Editor.tsx`**

Add import:

```ts
import { GIT_SETTINGS_TAB_PATH } from '@/components/Settings/paths'
import { GitSettingsPage } from '@/components/Settings/GitSettingsPage'
```

The existing `isSettingsTab` check already covers `settings://Git` (it checks `startsWith('settings://')`). But `isVirtual` currently always renders `<DisplayPage />`. Fix it to dispatch by path:

```tsx
// Replace:
isVirtual ? (
  <DisplayPage />
) : ...

// With:
isVirtual ? (
  activeTab?.path === GIT_SETTINGS_TAB_PATH ? <GitSettingsPage /> : <DisplayPage />
) : ...
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings/GitSettingsPage.tsx src/components/Settings/SettingsPanel.tsx src/components/Editor/Editor.tsx
git commit -m "feat: add Git settings page with force-push safety controls"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| 5 IPC commands (fetch/pull/push/forcePush/forcePushLease) | Task 1 |
| Streaming via `git:log:data` / `git:log:exit` | Task 1 |
| Preload exposure + type declarations | Task 2 |
| `gitLogStore` (append, no clear) | Task 3 |
| `gitSettingsStore` (4 fields, localStorage) | Task 3 |
| `gitStore` — 5 new actions + `commandStatus` | Task 4 |
| Opens Git Log tab + appends header line on run | Task 4 |
| `refresh()` on exit code 0 | Task 4 |
| `GIT_LOG_TAB_PATH`, `GIT_SETTINGS_TAB_PATH` constants | Task 5 |
| `GitLogView` — auto-scroll, plain pre, read-only | Task 5 |
| Single reused tab (dedup by path via `openTab`) | Task 5 |
| `Modal` primitive (Escape, backdrop close) | Task 6 |
| `ConfirmForcePushModal` — branch display, Cancel/Confirm | Task 6 |
| Countdown ticking, `autoContinue` variants | Task 6 |
| Force safety disabled = no modal, runs immediately | Task 7 |
| Right-click menu on footer branch area | Task 7 |
| Spinner while running (replaces ahead/behind counts) | Task 7 |
| Click-outside closes menu | Task 7 |
| Divider + red colour for force items | Task 7 |
| Git settings page — 3 toggles + seconds input | Task 8 |
| Settings panel sidebar nav item "Git" | Task 8 |
| Editor dispatches correct settings page by path | Task 8 |
| Overlap guard (backend) | Task 1 |
| UI disabled during run | Task 7 |

All spec requirements are covered. No placeholders. Type signatures are consistent across tasks (e.g. `GitCommandAction` defined in Task 1/`src/types/index.ts`, consumed in Tasks 2, 4, 7; `GIT_LOG_TAB_PATH` defined in Task 5, used in Task 4 as a string literal with a note to import once available — acceptable since the store is tested with mocks).
