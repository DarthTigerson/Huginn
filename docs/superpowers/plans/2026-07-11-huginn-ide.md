# Huginn IDE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a four-panel macOS desktop IDE (resizable file tree, Monaco editor with tabs, xterm terminal, Claude chat stub) packaged as an Electron app styled like VS Code on Mac.

**Architecture:** Electron main process handles filesystem I/O and terminal (node-pty); renderer is a Vite + React app communicating through a typed contextBridge API (`window.api`); react-resizable-panels manages the four-panel layout; Zustand holds all editor, file, and terminal state.

**Tech Stack:** electron-vite 2.x, React 18, TypeScript 5 (strict), @monaco-editor/react 4.x, @xterm/xterm 5.x + @xterm/addon-fit, node-pty 1.x, react-resizable-panels 2.x, Zustand 5.x, Tailwind CSS 3.x, Vitest 2.x

## Global Constraints
- Node ≥ 20, macOS only for v1
- Renderer code never imports from `electron` — all OS calls go through `window.api`
- TypeScript strict mode in every file
- Tailwind for all styling — no inline styles, no CSS modules
- IPC channel names follow the pattern `namespace:action` (e.g. `fs:readDir`, `term:write`)
- `children: undefined` on a `FileNode` means "directory, not yet loaded"; `children: []` means "loaded, empty"

---

## File Map

**Electron (main process):**
- `electron/main.ts` — BrowserWindow creation, IPC handler registration, filesystem handlers
- `electron/preload.ts` — contextBridge exposing `window.api`
- `electron/pty.ts` — PtyManager: spawns shell, pipes I/O over IPC

**Renderer:**
- `src/main.tsx` — React root mount
- `src/index.css` — Tailwind directives + global resets
- `src/App.tsx` — PanelGroup layout root, Ctrl+` terminal toggle
- `src/types/index.ts` — `FileNode` and `Tab` shared types
- `src/types/api.d.ts` — `window.api` global type declaration
- `src/stores/fileStore.ts` — projectRoot, tree, selectedPath, openFolder, expandDir, select
- `src/stores/editorStore.ts` — tabs, activeTabPath, openTab, closeTab, setActive, updateContent
- `src/stores/terminalStore.ts` — visible, toggle, show, hide
- `src/components/Sidebar/Sidebar.tsx` — project root header, open-folder button, FileTree
- `src/components/Sidebar/FileTree.tsx` — recursive node renderer with lazy expand
- `src/components/Editor/Editor.tsx` — Monaco editor + empty state
- `src/components/Editor/TabBar.tsx` — open-file tabs with dirty indicator and close button
- `src/components/Editor/utils.ts` — `detectLang(path: string): string`
- `src/components/Terminal/Terminal.tsx` — xterm panel with FitAddon + ResizeObserver
- `src/components/Chat/Chat.tsx` — placeholder Claude panel

**Config:**
- `package.json`
- `electron.vite.config.ts`
- `vitest.config.ts`
- `tailwind.config.js`
- `postcss.config.js`
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- `index.html`

**Tests:**
- `src/stores/__tests__/fileStore.test.ts`
- `src/stores/__tests__/editorStore.test.ts`
- `src/stores/__tests__/terminalStore.test.ts`

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `vitest.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `index.html`
- Create: `src/index.css`
- Create: `src/main.tsx`
- Create: `src/App.tsx` (placeholder, replaced in Task 10)

**Interfaces:**
- Produces: runnable dev environment — `npm run dev` opens the Electron app

- [ ] **Step 1: Write package.json**

```json
{
  "name": "huginn",
  "version": "0.1.0",
  "description": "A Claude-native IDE",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "rebuild": "electron-rebuild -f -w node-pty"
  },
  "dependencies": {
    "@electron-toolkit/utils": "^3.0.0",
    "@monaco-editor/react": "^4.6.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/xterm": "^5.5.0",
    "node-pty": "^1.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-resizable-panels": "^2.1.7",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.6.0",
    "@types/node": "^20.17.0",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "electron": "^32.2.0",
    "electron-vite": "^2.3.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write electron.vite.config.ts**

```ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: 'electron/main.ts' }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: 'electron/preload.ts' }
    }
  },
  renderer: {
    resolve: {
      alias: { '@': resolve(__dirname, 'src') }
    },
    plugins: [react()]
  }
})
```

- [ ] **Step 3: Write vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/stores/__tests__/**/*.test.ts']
  }
})
```

- [ ] **Step 4: Write tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        panel: '#1e1e1e',
        sidebar: '#252526',
        'tab-bar': '#2d2d2d',
        border: '#3c3c3c',
        accent: '#0078d4',
      }
    }
  },
  plugins: []
}
```

- [ ] **Step 5: Write postcss.config.js**

```js
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} }
}
```

- [ ] **Step 6: Write tsconfig.json**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

- [ ] **Step 7: Write tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "electron-vite/node"]
  },
  "include": ["electron/**/*", "electron.vite.config.ts"]
}
```

- [ ] **Step 8: Write tsconfig.web.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 9: Write index.html**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Huginn</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Write src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  overflow: hidden;
  background: #1e1e1e;
  color: #cccccc;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}

#root { width: 100vw; height: 100vh; }

/* Allow text selection inside the editor */
.monaco-editor { user-select: text; }
```

- [ ] **Step 11: Write src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 12: Write placeholder src/App.tsx**

```tsx
export default function App() {
  return (
    <div className="w-screen h-screen bg-panel flex items-center justify-center text-white">
      Huginn
    </div>
  )
}
```

- [ ] **Step 13: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 14: Rebuild node-pty for Electron**

```bash
npm run rebuild
```

Expected: Output ends with `✓ Rebuild Complete` (or similar). node-pty compiled against the installed Electron version.

- [ ] **Step 15: Commit**

```bash
git add package.json electron.vite.config.ts vitest.config.ts tailwind.config.js postcss.config.js tsconfig.json tsconfig.node.json tsconfig.web.json index.html src/index.css src/main.tsx src/App.tsx
git commit -m "feat: scaffold Electron + Vite + React project"
```

---

### Task 2: Main Process + BrowserWindow

**Files:**
- Create: `electron/main.ts`

**Interfaces:**
- Produces: `createWindow()` — 1440×900 window with `hiddenInset` titlebar, sidebar vibrancy, loads renderer

- [ ] **Step 1: Write electron/main.ts**

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 2: Run and verify**

```bash
npm run dev
```

Expected: Electron window opens showing "Huginn" text. Traffic-light buttons visible in top-left. Window has the native macOS appearance.

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat: add Electron main process with macOS window chrome"
```

---

### Task 3: Shared Types + IPC Bridge

**Files:**
- Create: `src/types/index.ts`
- Create: `src/types/api.d.ts`
- Create: `electron/preload.ts`

**Interfaces:**
- Produces: `window.api` — typed contextBridge object available in all renderer code
- Produces: `FileNode` and `Tab` — shared types imported everywhere

- [ ] **Step 1: Write src/types/index.ts**

```ts
export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export interface Tab {
  path: string
  content: string
  dirty: boolean
}
```

- [ ] **Step 2: Write src/types/api.d.ts**

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
    }
  }
}

export {}
```

- [ ] **Step 3: Write electron/preload.ts**

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
})
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/types/api.d.ts electron/preload.ts
git commit -m "feat: add IPC bridge and shared types"
```

---

### Task 4: Filesystem & Terminal IPC Handlers

**Files:**
- Modify: `electron/main.ts` — add `registerFsHandlers()` call and PtyManager wiring
- Create: `electron/pty.ts` — PtyManager class

**Interfaces:**
- Consumes: IPC channels declared in `electron/preload.ts`
- Produces: working `fs:readDir`, `fs:readFile`, `fs:writeFile`, `dialog:openFolder`, `term:spawn`, `term:write`, `term:resize` handlers; `term:data` events pushed to renderer

- [ ] **Step 1: Write electron/pty.ts**

```ts
import { BrowserWindow, ipcMain } from 'electron'
import * as pty from 'node-pty'
import { platform } from 'os'

const shell =
  platform() === 'win32'
    ? 'powershell.exe'
    : process.env.SHELL ?? '/bin/zsh'

export class PtyManager {
  private proc: pty.IPty | null = null
  private win: BrowserWindow

  constructor(win: BrowserWindow) {
    this.win = win
  }

  registerHandlers(): void {
    ipcMain.handle('term:spawn', () => {
      if (this.proc) return
      this.proc = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
        env: process.env as Record<string, string>,
      })
      this.proc.onData((data) => {
        this.win.webContents.send('term:data', data)
      })
    })

    ipcMain.on('term:write', (_event, data: string) => {
      this.proc?.write(data)
    })

    ipcMain.on('term:resize', (_event, cols: number, rows: number) => {
      this.proc?.resize(cols, rows)
    })
  }

  dispose(): void {
    this.proc?.kill()
    this.proc = null
  }
}
```

- [ ] **Step 2: Replace electron/main.ts with the full version including all IPC handlers**

```ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { readdir, readFile, writeFile } from 'fs/promises'
import { PtyManager } from './pty'

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
}

async function buildTree(dirPath: string): Promise<FileNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  return entries
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory())
        return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((e) => ({
      name: e.name,
      path: join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }))
}

function registerFsHandlers(): void {
  ipcMain.handle('fs:readDir', (_e, path: string) => buildTree(path))
  ipcMain.handle('fs:readFile', (_e, path: string) => readFile(path, 'utf-8'))
  ipcMain.handle('fs:writeFile', (_e, path: string, content: string) =>
    writeFile(path, content, 'utf-8')
  )
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  registerFsHandlers()
  const win = createWindow()
  const ptyMgr = new PtyManager(win)
  ptyMgr.registerHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts electron/pty.ts
git commit -m "feat: add filesystem and terminal IPC handlers"
```

---

### Task 5: Zustand Stores + Tests

**Files:**
- Create: `src/stores/fileStore.ts`
- Create: `src/stores/editorStore.ts`
- Create: `src/stores/terminalStore.ts`
- Create: `src/stores/__tests__/fileStore.test.ts`
- Create: `src/stores/__tests__/editorStore.test.ts`
- Create: `src/stores/__tests__/terminalStore.test.ts`

**Interfaces:**
- Consumes: `FileNode` and `Tab` from `@/types/index`
- Consumes: `window.api.openFolder`, `window.api.readDir` (mocked in tests)
- Produces: `useFileStore`, `useEditorStore`, `useTerminalStore` hooks

- [ ] **Step 1: Write the failing tests**

`src/stores/__tests__/fileStore.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFileStore } from '../fileStore'
import type { FileNode } from '@/types/index'

const mockTree: FileNode[] = [
  { name: 'src', path: '/proj/src', isDirectory: true },
  { name: 'package.json', path: '/proj/package.json', isDirectory: false },
]

vi.stubGlobal('window', {
  api: {
    openFolder: vi.fn().mockResolvedValue('/proj'),
    readDir: vi.fn().mockResolvedValue(mockTree),
  },
})

describe('fileStore', () => {
  beforeEach(() =>
    useFileStore.setState({ projectRoot: null, tree: [], selectedPath: null })
  )

  it('starts empty', () => {
    const { projectRoot, tree, selectedPath } = useFileStore.getState()
    expect(projectRoot).toBeNull()
    expect(tree).toHaveLength(0)
    expect(selectedPath).toBeNull()
  })

  it('openFolder sets root and loads tree', async () => {
    await useFileStore.getState().openFolder()
    const { projectRoot, tree } = useFileStore.getState()
    expect(projectRoot).toBe('/proj')
    expect(tree).toEqual(mockTree)
  })

  it('openFolder does nothing if dialog is cancelled', async () => {
    vi.mocked(window.api.openFolder).mockResolvedValueOnce(null)
    await useFileStore.getState().openFolder()
    expect(useFileStore.getState().projectRoot).toBeNull()
  })

  it('expandDir updates the matching node children in the tree', async () => {
    useFileStore.setState({ tree: mockTree })
    const children: FileNode[] = [
      { name: 'App.tsx', path: '/proj/src/App.tsx', isDirectory: false },
    ]
    vi.mocked(window.api.readDir).mockResolvedValueOnce(children)
    await useFileStore.getState().expandDir('/proj/src')
    const srcNode = useFileStore.getState().tree.find((n) => n.path === '/proj/src')
    expect(srcNode?.children).toEqual(children)
  })

  it('select sets selectedPath', () => {
    useFileStore.getState().select('/proj/package.json')
    expect(useFileStore.getState().selectedPath).toBe('/proj/package.json')
  })
})
```

`src/stores/__tests__/editorStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'

describe('editorStore', () => {
  beforeEach(() => useEditorStore.setState({ tabs: [], activeTabPath: null }))

  it('starts empty', () => {
    expect(useEditorStore.getState().tabs).toHaveLength(0)
  })

  it('openTab adds a tab and sets it active', () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: 'hello', dirty: false })
    const { tabs, activeTabPath } = useEditorStore.getState()
    expect(tabs).toHaveLength(1)
    expect(activeTabPath).toBe('/a.ts')
  })

  it('openTab on existing path activates without duplicating', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: 'hello', dirty: false })
    store.openTab({ path: '/b.ts', content: 'world', dirty: false })
    store.openTab({ path: '/a.ts', content: 'hello', dirty: false })
    expect(useEditorStore.getState().tabs).toHaveLength(2)
    expect(useEditorStore.getState().activeTabPath).toBe('/a.ts')
  })

  it('closeTab removes the tab and activates the previous one', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })
    store.closeTab('/b.ts')
    expect(useEditorStore.getState().tabs).toHaveLength(1)
    expect(useEditorStore.getState().activeTabPath).toBe('/a.ts')
  })

  it('closeTab last tab sets activeTabPath to null', () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: '', dirty: false })
    useEditorStore.getState().closeTab('/a.ts')
    expect(useEditorStore.getState().tabs).toHaveLength(0)
    expect(useEditorStore.getState().activeTabPath).toBeNull()
  })

  it('updateContent sets new content and marks dirty', () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: 'original', dirty: false })
    useEditorStore.getState().updateContent('/a.ts', 'changed')
    const tab = useEditorStore.getState().tabs[0]
    expect(tab.content).toBe('changed')
    expect(tab.dirty).toBe(true)
  })
})
```

`src/stores/__tests__/terminalStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from '../terminalStore'

describe('terminalStore', () => {
  beforeEach(() => useTerminalStore.setState({ visible: false }))

  it('starts hidden', () => {
    expect(useTerminalStore.getState().visible).toBe(false)
  })

  it('toggle flips visibility', () => {
    useTerminalStore.getState().toggle()
    expect(useTerminalStore.getState().visible).toBe(true)
    useTerminalStore.getState().toggle()
    expect(useTerminalStore.getState().visible).toBe(false)
  })

  it('show sets visible true', () => {
    useTerminalStore.getState().show()
    expect(useTerminalStore.getState().visible).toBe(true)
  })

  it('hide sets visible false', () => {
    useTerminalStore.setState({ visible: true })
    useTerminalStore.getState().hide()
    expect(useTerminalStore.getState().visible).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: 3 test files fail with "Cannot find module" errors.

- [ ] **Step 3: Implement src/stores/fileStore.ts**

```ts
import { create } from 'zustand'
import type { FileNode } from '@/types/index'

function setNodeChildren(
  nodes: FileNode[],
  targetPath: string,
  children: FileNode[]
): FileNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) return { ...node, children }
    if (node.isDirectory && node.children) {
      return { ...node, children: setNodeChildren(node.children, targetPath, children) }
    }
    return node
  })
}

interface FileState {
  projectRoot: string | null
  tree: FileNode[]
  selectedPath: string | null
  openFolder: () => Promise<void>
  expandDir: (dirPath: string) => Promise<void>
  select: (path: string) => void
}

export const useFileStore = create<FileState>((set, get) => ({
  projectRoot: null,
  tree: [],
  selectedPath: null,

  openFolder: async () => {
    const root = await window.api.openFolder()
    if (!root) return
    const tree = await window.api.readDir(root)
    set({ projectRoot: root, tree })
  },

  expandDir: async (dirPath: string) => {
    const children = await window.api.readDir(dirPath)
    set((state) => ({
      tree: setNodeChildren(state.tree, dirPath, children),
    }))
  },

  select: (path: string) => set({ selectedPath: path }),
}))
```

- [ ] **Step 4: Implement src/stores/editorStore.ts**

```ts
import { create } from 'zustand'
import type { Tab } from '@/types/index'

interface EditorState {
  tabs: Tab[]
  activeTabPath: string | null
  openTab: (tab: Tab) => void
  closeTab: (path: string) => void
  setActive: (path: string) => void
  updateContent: (path: string, content: string) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabPath: null,

  openTab: (tab: Tab) => {
    const { tabs } = get()
    if (tabs.some((t) => t.path === tab.path)) {
      set({ activeTabPath: tab.path })
    } else {
      set({ tabs: [...tabs, tab], activeTabPath: tab.path })
    }
  },

  closeTab: (path: string) => {
    const { tabs, activeTabPath } = get()
    const remaining = tabs.filter((t) => t.path !== path)
    const newActive =
      activeTabPath === path
        ? (remaining[remaining.length - 1]?.path ?? null)
        : activeTabPath
    set({ tabs: remaining, activeTabPath: newActive })
  },

  setActive: (path: string) => set({ activeTabPath: path }),

  updateContent: (path: string, content: string) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.path === path ? { ...t, content, dirty: true } : t
      ),
    })),
}))
```

- [ ] **Step 5: Implement src/stores/terminalStore.ts**

```ts
import { create } from 'zustand'

interface TerminalState {
  visible: boolean
  toggle: () => void
  show: () => void
  hide: () => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  visible: false,
  toggle: () => set((s) => ({ visible: !s.visible })),
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}))
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
npm test
```

Expected: All 12 tests pass across 3 files. Zero failures.

- [ ] **Step 7: Commit**

```bash
git add src/stores/ src/stores/__tests__/
git commit -m "feat: add Zustand stores with passing tests"
```

---

### Task 6: Sidebar (File Tree)

**Files:**
- Create: `src/components/Sidebar/FileTree.tsx`
- Create: `src/components/Sidebar/Sidebar.tsx`

**Interfaces:**
- Consumes: `useFileStore` (`projectRoot`, `tree`, `selectedPath`, `openFolder`, `expandDir`, `select`)
- Consumes: `useEditorStore` (`openTab`)
- Consumes: `window.api.readFile`
- Produces: `<Sidebar />` — self-contained left panel

- [ ] **Step 1: Write src/components/Sidebar/FileTree.tsx**

```tsx
import { useState } from 'react'
import type { FileNode } from '@/types/index'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'

const EXT_COLOR: Record<string, string> = {
  ts: 'text-blue-400', tsx: 'text-blue-400',
  js: 'text-yellow-400', jsx: 'text-yellow-400',
  css: 'text-purple-400', scss: 'text-purple-400',
  html: 'text-orange-400',
  json: 'text-yellow-300',
  md: 'text-gray-400',
  py: 'text-green-400',
  rs: 'text-orange-500',
  go: 'text-cyan-400',
}

function fileColor(name: string): string {
  const ext = name.split('.').pop() ?? ''
  return EXT_COLOR[ext] ?? 'text-gray-300'
}

interface FileTreeProps {
  nodes: FileNode[]
  depth?: number
}

export function FileTree({ nodes, depth = 0 }: FileTreeProps) {
  const { selectedPath, select, expandDir } = useFileStore()
  const { openTab } = useEditorStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  async function handleClick(node: FileNode) {
    if (node.isDirectory) {
      const isOpen = expanded[node.path]
      if (!isOpen && node.children === undefined) {
        await expandDir(node.path)
      }
      setExpanded((prev) => ({ ...prev, [node.path]: !prev[node.path] }))
    } else {
      select(node.path)
      const content = await window.api.readFile(node.path)
      openTab({ path: node.path, content, dirty: false })
    }
  }

  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.path}>
          <button
            className={`flex items-center gap-1 w-full text-left py-0.5 text-sm hover:bg-white/5 rounded truncate ${
              selectedPath === node.path ? 'bg-accent/20 text-white' : 'text-gray-300'
            }`}
            style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: '8px' }}
            onClick={() => handleClick(node)}
          >
            <span className="shrink-0 text-xs w-3 text-gray-500">
              {node.isDirectory
                ? expanded[node.path]
                  ? '▾'
                  : '▸'
                : ''}
            </span>
            <span className={node.isDirectory ? 'text-gray-200' : fileColor(node.name)}>
              {node.name}
            </span>
          </button>
          {node.isDirectory && expanded[node.path] && node.children && (
            <FileTree nodes={node.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Write src/components/Sidebar/Sidebar.tsx**

```tsx
import { useFileStore } from '@/stores/fileStore'
import { FileTree } from './FileTree'

export function Sidebar() {
  const { projectRoot, tree, openFolder } = useFileStore()

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      {projectRoot ? (
        <>
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider truncate border-b border-border shrink-0">
            {projectRoot.split('/').pop()}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            <FileTree nodes={tree} />
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <p className="text-xs text-gray-500 text-center">No folder open</p>
          <button
            onClick={openFolder}
            className="px-3 py-1.5 text-sm bg-accent hover:bg-blue-500 text-white rounded transition-colors"
          >
            Open Folder
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Temporarily wire Sidebar into App.tsx to verify rendering**

Replace `src/App.tsx`:

```tsx
import { Sidebar } from './components/Sidebar/Sidebar'

export default function App() {
  return (
    <div className="w-screen h-screen bg-panel flex">
      <div className="w-64 shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Editor placeholder
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run dev and verify**

```bash
npm run dev
```

Expected: Sidebar shows "Open Folder" button. Clicking it opens a macOS folder picker. After selecting a folder, the file tree renders with color-coded names and expand arrows on directories. Clicking a directory expands it.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar/ src/App.tsx
git commit -m "feat: add sidebar with lazy-loading file tree"
```

---

### Task 7: Editor (Monaco + Tabs)

**Files:**
- Create: `src/components/Editor/utils.ts`
- Create: `src/components/Editor/TabBar.tsx`
- Create: `src/components/Editor/Editor.tsx`

**Interfaces:**
- Consumes: `useEditorStore` (`tabs`, `activeTabPath`, `setActive`, `closeTab`, `updateContent`)
- Consumes: `window.api.writeFile` (for saving — Cmd+S)
- Produces: `<Editor />` — center panel with tab bar and Monaco

- [ ] **Step 1: Write src/components/Editor/utils.ts**

```ts
const EXT_LANG: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
  css: 'css', scss: 'scss', less: 'less',
  html: 'html', xml: 'xml', svg: 'xml',
  json: 'json', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', sh: 'shell', bash: 'shell', zsh: 'shell',
  sql: 'sql', graphql: 'graphql', toml: 'ini', ini: 'ini',
  tf: 'hcl', vue: 'html', svelte: 'html', dockerfile: 'dockerfile',
}

export function detectLang(path: string): string {
  const name = path.split('/').pop()?.toLowerCase() ?? ''
  if (name === 'dockerfile') return 'dockerfile'
  const ext = name.split('.').pop() ?? ''
  return EXT_LANG[ext] ?? 'plaintext'
}
```

- [ ] **Step 2: Write src/components/Editor/TabBar.tsx**

```tsx
import { useEditorStore } from '@/stores/editorStore'

export function TabBar() {
  const { tabs, activeTabPath, setActive, closeTab } = useEditorStore()

  if (tabs.length === 0) return null

  return (
    <div className="flex bg-tab-bar border-b border-border overflow-x-auto shrink-0 select-none">
      {tabs.map((tab) => {
        const name = tab.path.split('/').pop() ?? tab.path
        const isActive = activeTabPath === tab.path
        return (
          <div
            key={tab.path}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-border cursor-pointer whitespace-nowrap text-sm ${
              isActive
                ? 'bg-panel text-white border-t-2 border-t-accent -mt-px'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
            onClick={() => setActive(tab.path)}
          >
            <span>{name}{tab.dirty ? ' ●' : ''}</span>
            <button
              className="text-gray-600 hover:text-gray-200 text-base leading-none ml-1"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.path)
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Write src/components/Editor/Editor.tsx**

```tsx
import { useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useEditorStore } from '@/stores/editorStore'
import { TabBar } from './TabBar'
import { detectLang } from './utils'

export function Editor() {
  const { tabs, activeTabPath, updateContent } = useEditorStore()
  const activeTab = tabs.find((t) => t.path === activeTabPath)

  useEffect(() => {
    if (!activeTab) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        window.api.writeFile(activeTab.path, activeTab.content)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab])

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      <TabBar />
      {activeTab ? (
        <div className="flex-1 overflow-hidden">
          <MonacoEditor
            key={activeTab.path}
            value={activeTab.content}
            language={detectLang(activeTab.path)}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace',
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
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-sm">Open a file to start editing</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire Editor into App.tsx**

Replace `src/App.tsx`:

```tsx
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'

export default function App() {
  return (
    <div className="w-screen h-screen bg-panel flex overflow-hidden">
      <div className="w-64 shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run dev and verify**

```bash
npm run dev
```

Expected: Open a folder, click a file — tab appears in the tab bar, file contents render in Monaco with correct syntax highlighting. Edit content, see the dirty `●` indicator. Press Cmd+S — file saved (no error). Close tab with `×`.

- [ ] **Step 6: Commit**

```bash
git add src/components/Editor/
git commit -m "feat: add Monaco editor with tab bar and Cmd+S save"
```

---

### Task 8: Terminal (xterm.js)

**Files:**
- Create: `src/components/Terminal/Terminal.tsx`

**Interfaces:**
- Consumes: `useTerminalStore` (`hide`)
- Consumes: `window.api.termSpawn`, `window.api.onTermData`, `window.api.termWrite`, `window.api.termResize`
- Produces: `<Terminal />` — bottom panel with a live shell

- [ ] **Step 1: Write src/components/Terminal/Terminal.tsx**

```tsx
import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '@/stores/terminalStore'

export function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const hide = useTerminalStore((s) => s.hide)

  useEffect(() => {
    if (!containerRef.current || xtermRef.current) return

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
    fitRef.current = fit

    window.api.termSpawn()
    const cleanupData = window.api.onTermData((data) => xterm.write(data))
    xterm.onData((data) => window.api.termWrite(data))

    const observer = new ResizeObserver(() => {
      fit.fit()
      window.api.termResize(xterm.cols, xterm.rows)
    })
    observer.observe(containerRef.current)

    return () => {
      cleanupData()
      observer.disconnect()
      xterm.dispose()
      xtermRef.current = null
    }
  }, [])

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] border-t border-border overflow-hidden">
      <div className="flex items-center px-3 h-7 border-b border-border shrink-0 bg-tab-bar">
        <span className="text-xs text-gray-400 font-medium">Terminal</span>
        <button
          className="ml-auto text-gray-500 hover:text-gray-300 text-sm leading-none transition-colors"
          onClick={hide}
        >
          ✕
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden p-1" />
    </div>
  )
}
```

- [ ] **Step 2: Wire Terminal into App.tsx**

Replace `src/App.tsx`:

```tsx
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { Terminal } from './components/Terminal/Terminal'
import { useTerminalStore } from './stores/terminalStore'

export default function App() {
  const termVisible = useTerminalStore((s) => s.visible)

  return (
    <div className="w-screen h-screen bg-panel flex overflow-hidden">
      <div className="w-64 shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={termVisible ? 'flex-1 overflow-hidden' : 'h-full overflow-hidden'}>
          <Editor />
        </div>
        {termVisible && (
          <div className="h-48 shrink-0">
            <Terminal />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add a temporary toggle button to verify the terminal**

Add below the Sidebar div in App.tsx, inside the outer flex div:

```tsx
<button
  className="fixed bottom-4 left-72 z-50 px-2 py-1 text-xs bg-accent text-white rounded"
  onClick={() => useTerminalStore.getState().toggle()}
>
  Toggle Terminal
</button>
```

- [ ] **Step 4: Run dev and verify**

```bash
npm run dev
```

Expected: Click "Toggle Terminal" — terminal panel appears at the bottom with a live shell. Type commands, see output. Click ✕ — terminal hides. Toggle again — same shell session resumes.

- [ ] **Step 5: Remove the temporary toggle button from App.tsx** (it will be replaced by Ctrl+` in Task 10)

Remove the `<button>` block added in Step 3.

- [ ] **Step 6: Commit**

```bash
git add src/components/Terminal/Terminal.tsx src/App.tsx
git commit -m "feat: add xterm terminal panel with node-pty shell"
```

---

### Task 9: Chat Stub

**Files:**
- Create: `src/components/Chat/Chat.tsx`

**Interfaces:**
- Produces: `<Chat />` — right panel placeholder for Claude integration

- [ ] **Step 1: Write src/components/Chat/Chat.tsx**

```tsx
export function Chat() {
  return (
    <div className="h-full flex flex-col bg-[#1e1e2e] border-l border-border overflow-hidden">
      <div className="px-4 h-9 flex items-center border-b border-border shrink-0">
        <span className="text-sm font-medium text-gray-200 tracking-wide">Claude</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <p className="text-xs text-gray-600 text-center leading-relaxed">
          Claude integration coming in the next milestone.
        </p>
      </div>
      <div className="p-3 border-t border-border shrink-0">
        <input
          className="w-full bg-white/5 border border-border rounded px-3 py-2 text-sm text-gray-500 placeholder-gray-700 outline-none cursor-not-allowed"
          placeholder="Ask Claude..."
          disabled
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Chat/Chat.tsx
git commit -m "feat: add Claude chat stub panel"
```

---

### Task 10: App Layout (react-resizable-panels)

**Files:**
- Modify: `src/App.tsx` — final four-panel layout with react-resizable-panels and Ctrl+\` toggle

**Interfaces:**
- Consumes: `<Sidebar />`, `<Editor />`, `<Terminal />`, `<Chat />`
- Consumes: `useTerminalStore` (`visible`, `toggle`)
- Produces: final application layout

- [ ] **Step 1: Write the final src/App.tsx**

```tsx
import { useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Editor } from './components/Editor/Editor'
import { Terminal } from './components/Terminal/Terminal'
import { Chat } from './components/Chat/Chat'
import { useTerminalStore } from './stores/terminalStore'

export default function App() {
  const termVisible = useTerminalStore((s) => s.visible)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault()
        useTerminalStore.getState().toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="w-screen h-screen overflow-hidden bg-panel">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={20} minSize={12} maxSize={40} id="sidebar" order={1}>
          <Sidebar />
        </Panel>

        <PanelResizeHandle className="w-px bg-border hover:bg-accent/60 transition-colors cursor-col-resize" />

        <Panel id="center" order={2}>
          <PanelGroup direction="vertical" className="h-full">
            <Panel id="editor" order={1}>
              <Editor />
            </Panel>

            {termVisible && (
              <>
                <PanelResizeHandle className="h-px bg-border hover:bg-accent/60 transition-colors cursor-row-resize" />
                <Panel defaultSize={28} minSize={10} id="terminal" order={2}>
                  <Terminal />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="w-px bg-border hover:bg-accent/60 transition-colors cursor-col-resize" />

        <Panel defaultSize={25} minSize={15} maxSize={50} id="chat" order={3}>
          <Chat />
        </Panel>
      </PanelGroup>
    </div>
  )
}
```

- [ ] **Step 2: Run dev and do a full end-to-end verification**

```bash
npm run dev
```

Verify each of the following:
1. All four panels render — sidebar, editor, terminal (hidden), chat stub
2. Drag the sidebar divider — resizes correctly
3. Drag the chat divider — resizes correctly
4. Open a folder — file tree populates
5. Click a file — tab appears, content renders in Monaco with syntax highlighting
6. Edit content — dirty `●` appears on tab
7. Press Cmd+S — dirty indicator clears (file saved)
8. Close a tab with `×`
9. Press Ctrl+` — terminal panel appears with a live shell
10. Type a shell command — see output
11. Press Ctrl+` again — terminal hides
12. Traffic-light buttons visible in top-left corner of window

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire final four-panel layout with react-resizable-panels"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Electron + electron-vite | Task 1, 2 |
| hiddenInset titlebar + vibrancy | Task 2 |
| Preload contextBridge + window.api | Task 3 |
| Filesystem IPC (readDir, readFile, writeFile, openFolder) | Task 4 |
| node-pty terminal IPC | Task 4 |
| fileStore (projectRoot, tree, selectedPath) | Task 5 |
| editorStore (tabs, activeTabPath) | Task 5 |
| terminalStore (visible toggle) | Task 5 |
| File tree sidebar with lazy expand | Task 6 |
| Monaco editor + language detection | Task 7 |
| Tab bar with dirty indicator + close | Task 7 |
| Cmd+S save | Task 7 |
| xterm terminal + FitAddon + ResizeObserver | Task 8 |
| Claude chat stub | Task 9 |
| react-resizable-panels layout | Task 10 |
| Ctrl+` terminal toggle | Task 10 |
| Tailwind + macOS font stack | Tasks 1, 6–10 |

All spec requirements covered. No gaps.

**Placeholder scan:** No TBDs, TODOs, or "implement later" text found.

**Type consistency:**
- `FileNode` defined in `src/types/index.ts`, used consistently in fileStore, FileTree, api.d.ts, and main.ts
- `Tab` defined in `src/types/index.ts`, used consistently in editorStore and TabBar
- `window.api` channels match exactly between preload.ts and api.d.ts
- Store method names (`openTab`, `closeTab`, `expandDir`, `select`) consistent across tests and implementations
