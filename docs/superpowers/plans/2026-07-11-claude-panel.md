# Claude Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Chat.tsx` placeholder with a live xterm.js terminal that auto-spawns the `claude` CLI in the open project directory.

**Architecture:** A new `ClaudeManager` class in the Electron main process mirrors `PtyManager` exactly, using dedicated `claude:*` IPC channels. The renderer component reads `projectRoot` from `fileStore`, renders a placeholder when no project is open, and initialises xterm + calls `claudeSpawn(projectRoot)` the first time a project root is available.

**Tech Stack:** node-pty, @xterm/xterm + @xterm/addon-fit, Zustand (fileStore), Electron contextBridge, TypeScript strict

## Global Constraints
- macOS only for v1
- Renderer never imports from `electron` — all IPC through `window.api`
- TypeScript strict mode in every file
- Tailwind for all styling — no inline styles
- IPC channel names follow `namespace:action` pattern: `claude:spawn`, `claude:write`, `claude:resize`, `claude:data`
- No auto-respawn when project root changes — Claude session is spawned once and persists

---

## File Map

**Electron (main process):**
- Create: `electron/claude.ts` — `ClaudeManager` class: spawn, write, resize, error handling
- Modify: `electron/main.ts` — instantiate `ClaudeManager`, call `registerHandlers()`
- Modify: `electron/preload.ts` — add `claudeSpawn`, `claudeWrite`, `claudeResize`, `onClaudeData`
- Modify: `src/types/api.d.ts` — typed signatures for the four new methods

**Renderer:**
- Modify: `src/components/Chat/Chat.tsx` — replace stub with xterm terminal

---

### Task 1: ClaudeManager + IPC Plumbing

**Files:**
- Create: `electron/claude.ts`
- Modify: `electron/main.ts` (lines 1, 68–77)
- Modify: `electron/preload.ts` (lines 3–19)
- Modify: `src/types/api.d.ts` (lines 5–15)

**Interfaces:**
- Consumes: `node-pty`, `electron` (BrowserWindow, ipcMain, ipcRenderer)
- Produces: `ClaudeManager` class with `registerHandlers()` and `dispose()`; `window.api.claudeSpawn(cwd)`, `window.api.claudeWrite(data)`, `window.api.claudeResize(cols, rows)`, `window.api.onClaudeData(cb)` — consumed by Task 2

No unit-testable pure logic in this task — verification is TypeScript compilation.

- [ ] **Step 1: Write `electron/claude.ts`**

```ts
import { BrowserWindow, ipcMain } from 'electron'
import * as pty from 'node-pty'

export class ClaudeManager {
  private proc: pty.IPty | null = null
  private win: BrowserWindow

  constructor(win: BrowserWindow) {
    this.win = win
  }

  registerHandlers(): void {
    ipcMain.handle('claude:spawn', (_event, cwd: string) => {
      if (this.proc) return
      try {
        this.proc = pty.spawn('claude', [], {
          name: 'xterm-color',
          cols: 80,
          rows: 24,
          cwd,
          env: process.env as Record<string, string>,
        })
        this.proc.onData((data) => {
          this.win.webContents.send('claude:data', data)
        })
      } catch {
        this.win.webContents.send(
          'claude:data',
          "\r\nError: 'claude' not found in PATH.\r\nInstall it with: npm install -g @anthropic-ai/claude-code\r\n"
        )
      }
    })

    ipcMain.on('claude:write', (_event, data: string) => {
      this.proc?.write(data)
    })

    ipcMain.on('claude:resize', (_event, cols: number, rows: number) => {
      this.proc?.resize(cols, rows)
    })
  }

  dispose(): void {
    this.proc?.kill()
    this.proc = null
  }
}
```

- [ ] **Step 2: Update `electron/main.ts` — add ClaudeManager import and instantiation**

Add the import at the top alongside the PtyManager import:
```ts
import { ClaudeManager } from './claude'
```

In `app.whenReady().then(...)`, add ClaudeManager after PtyManager:
```ts
app.whenReady().then(() => {
  registerFsHandlers()
  const win = createWindow()
  const ptyMgr = new PtyManager(win)
  ptyMgr.registerHandlers()
  const claudeMgr = new ClaudeManager(win)
  claudeMgr.registerHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
```

- [ ] **Step 3: Update `electron/preload.ts` — add four claude methods**

Replace the entire file:
```ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  readDir: (path: string) => ipcRenderer.invoke('fs:readDir', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('fs:writeFile', path, content),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  termSpawn: () => ipcRenderer.invoke('term:spawn'),
  termWrite: (data: string) => ipcRenderer.send('term:write', data),
  termResize: (cols: number, rows: number) =>
    ipcRenderer.send('term:resize', cols, rows),
  onTermData: (cb: (data: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: string) => cb(data)
    ipcRenderer.on('term:data', handler)
    return () => ipcRenderer.removeListener('term:data', handler)
  },

  claudeSpawn: (cwd: string) => ipcRenderer.invoke('claude:spawn', cwd),
  claudeWrite: (data: string) => ipcRenderer.send('claude:write', data),
  claudeResize: (cols: number, rows: number) =>
    ipcRenderer.send('claude:resize', cols, rows),
  onClaudeData: (cb: (data: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: string) => cb(data)
    ipcRenderer.on('claude:data', handler)
    return () => ipcRenderer.removeListener('claude:data', handler)
  },
})
```

- [ ] **Step 4: Update `src/types/api.d.ts` — add four claude method types**

Replace the entire file:
```ts
import type { FileNode } from './index'

declare global {
  interface Window {
    api: {
      readDir: (path: string) => Promise<FileNode[]>
      readFile: (path: string) => Promise<string>
      writeFile: (path: string, content: string) => Promise<void>
      openFolder: () => Promise<string | null>

      termSpawn: () => Promise<void>
      termWrite: (data: string) => void
      termResize: (cols: number, rows: number) => void
      onTermData: (cb: (data: string) => void) => () => void

      claudeSpawn: (cwd: string) => Promise<void>
      claudeWrite: (data: string) => void
      claudeResize: (cols: number, rows: number) => void
      onClaudeData: (cb: (data: string) => void) => () => void
    }
  }
}

export {}
```

- [ ] **Step 5: Verify TypeScript compiles clean**

```bash
npx tsc -p tsconfig.node.json --noEmit && npx tsc -p tsconfig.web.json --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add electron/claude.ts electron/main.ts electron/preload.ts src/types/api.d.ts
git commit -m "feat: add ClaudeManager and claude:* IPC channels"
```

---

### Task 2: Claude Panel Component

**Files:**
- Modify: `src/components/Chat/Chat.tsx` — replace entirely

**Interfaces:**
- Consumes: `useFileStore` (`projectRoot: string | null`) from `@/stores/fileStore`
- Consumes: `window.api.claudeSpawn(cwd)`, `window.api.onClaudeData(cb)`, `window.api.claudeWrite(data)`, `window.api.claudeResize(cols, rows)` — defined in Task 1
- Consumes: `@xterm/xterm`, `@xterm/addon-fit` (already installed)

No unit-testable pure logic — verification is TypeScript compilation.

- [ ] **Step 1: Replace `src/components/Chat/Chat.tsx` entirely**

```tsx
import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useFileStore } from '@/stores/fileStore'

export function Chat() {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const spawnedRef = useRef(false)

  useEffect(() => {
    if (!projectRoot || !containerRef.current || spawnedRef.current) return
    spawnedRef.current = true

    const xterm = new XTerm({
      theme: {
        background: '#1a1a1a',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
      },
      fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
    })

    const fit = new FitAddon()
    xterm.loadAddon(fit)
    xterm.open(containerRef.current)
    fit.fit()
    xtermRef.current = xterm

    window.api.claudeSpawn(projectRoot)
    const cleanupData = window.api.onClaudeData((data) => xterm.write(data))
    xterm.onData((data) => window.api.claudeWrite(data))

    const observer = new ResizeObserver(() => {
      fit.fit()
      window.api.claudeResize(xterm.cols, xterm.rows)
    })
    observer.observe(containerRef.current)

    return () => {
      cleanupData()
      observer.disconnect()
      xterm.dispose()
      xtermRef.current = null
    }
  }, [projectRoot])

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] border-l border-border overflow-hidden">
      <div className="flex items-center px-3 h-7 border-b border-border shrink-0 bg-tab-bar">
        <span className="text-xs text-gray-400 font-medium">Claude</span>
      </div>
      {projectRoot ? (
        <div ref={containerRef} className="flex-1 overflow-hidden p-1" />
      ) : (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            Open a folder to start Claude
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc -p tsconfig.web.json --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 3: Run store tests to confirm nothing regressed**

```bash
npm test
```

Expected: 15/15 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/Chat/Chat.tsx
git commit -m "feat: replace chat stub with Claude terminal panel"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| ClaudeManager with claude:spawn/write/resize/data channels | Task 1 |
| Catches spawn error, sends human-readable message | Task 1 |
| Double-spawn guard (`if (this.proc) return`) | Task 1 |
| preload exposes claudeSpawn/claudeWrite/claudeResize/onClaudeData | Task 1 |
| api.d.ts typed signatures | Task 1 |
| xterm same theme/font as Terminal.tsx | Task 2 |
| FitAddon + ResizeObserver | Task 2 |
| Spawns in projectRoot from fileStore | Task 2 |
| Placeholder when no project open | Task 2 |
| Single spawn via spawnedRef (no re-spawn on project change) | Task 2 |
| No close button | Task 2 |

**Placeholder scan:** No TBDs. All steps have complete code.

**Type consistency:**
- `claudeSpawn(cwd: string)` — matches in preload, api.d.ts, and Chat.tsx call site
- `claudeWrite(data: string)` — consistent across all three files
- `claudeResize(cols: number, rows: number)` — consistent
- `onClaudeData(cb: (data: string) => void) => () => void` — consistent
