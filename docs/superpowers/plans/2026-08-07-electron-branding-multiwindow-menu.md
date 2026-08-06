# Electron Branding, Multi-Window, and Menu Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand Huginn from default Electron chrome to its own name/icon (dev + packaged), let multiple windows each run an independently-isolated project (own terminal/git/Claude/Cosmos/browser tabs), and fill out the menu bar with real, discoverable items.

**Architecture:** Four phases, ordered by dependency, not by the spec's section order — Part 3 of the spec ("New Window" / "Recent Projects" / dynamic Window menu) depends on the multi-window backend existing first, so those specific menu items move to a fourth phase after multi-window, while every other menu item is phase-2-independent:
1. Branding (Dock icon via `app.dock.setIcon`, dev-mode menu-bar name via `Info.plist` patch, `electron-builder` packaging config)
2. Menu overhaul, part A (every new item except New Window/Recent Projects/dynamic Window menu)
3. Multi-window backend (six manager classes converted from single-`win` to per-window-map, window lifecycle, recents persistence)
4. Menu overhaul, part B (New Window, Recent Projects, dynamic Window menu)

**Tech Stack:** Electron 32, electron-vite, TypeScript, React, zustand, vitest. No new runtime dependencies except `electron-builder` (devDependency).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-electron-branding-multiwindow-menu-design.md`
- No code signing/notarization — unsigned builds only, this round.
- `MobileServer` and the Cosmos API-key settings handlers stay app-wide singletons — do not convert them to per-window.
- Every shortcut promoted into the native menu must have its old raw `window.addEventListener('keydown', …)` branch removed from the renderer — single source of truth, per spec's "Handling the promoted shortcuts without double-firing" section.
- `npm run test` (vitest) must pass after every task.
- Run `npx tsc --noEmit -p tsconfig.node.json` (electron/main process) and `-p tsconfig.web.json` (renderer) after any task touching `.ts`/`.tsx` files with type declarations — this codebase has no lint step wired into these tasks, so the type checker is the only automated guard against typos in the IPC channel plumbing.

---

## Phase 1 — Branding

### Task 1: Dock icon at runtime

**Files:**
- Modify: `electron/main.ts`

**Interfaces:**
- Produces: nothing consumed by later tasks — self-contained.

- [ ] **Step 1: Add the runtime Dock icon call**

In `electron/main.ts`, add `join` is already imported; add this inside `app.whenReady().then(() => { ... })`, as the very first line of the callback (before `buildMenu()`):

```ts
app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.setIcon(join(__dirname, '../../icon.png'))
  }
  buildMenu()
  ...
```

`__dirname` at runtime is `out/main/` (electron-vite's build output), so `../../icon.png` resolves to the repo-root `icon.png` in dev. Packaged builds get their Dock icon from `electron-builder`'s `icon` config (Task 3) instead — this call is harmless but redundant there, so no platform-specific packaged/dev branching is needed beyond the existing `darwin` check.

- [ ] **Step 2: Manual verification**

Run `npm run dev`. Confirm the Dock icon (while the app is running) shows the Huginn hexagon icon instead of the default Electron logo. This is OS chrome — not unit-testable under jsdom/vitest.

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "Set Dock icon at runtime via app.dock.setIcon"
```

---

### Task 2: Dev-mode menu-bar name rebrand

**Files:**
- Create: `scripts/rebrand-electron.mjs`
- Modify: `package.json` (add `postinstall` script)

**Interfaces:**
- Produces: nothing consumed by later tasks — self-contained.

- [ ] **Step 1: Write the rebrand script**

Create `scripts/rebrand-electron.mjs`:

```js
#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const plistPath = join(repoRoot, 'node_modules/electron/dist/Electron.app/Contents/Info.plist')

function main() {
  if (process.platform !== 'darwin') return
  if (!existsSync(plistPath)) return // electron not installed yet, or non-mac CI

  const currentName = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleName', plistPath], {
    encoding: 'utf-8',
  }).trim()
  if (currentName === 'Huginn') return // already rebranded, idempotent no-op

  for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} Huginn`, plistPath])
  }
  console.log('[rebrand-electron] Patched dev Electron.app bundle name to "Huginn".')
}

try {
  main()
} catch (err) {
  console.warn('[rebrand-electron] Skipped (non-fatal):', err.message)
}
```

Uses `/usr/libexec/PlistBuddy` (present on every macOS install) rather than a plist-parsing npm package, to avoid adding a dependency for a two-key edit. `readFileSync`/`writeFileSync` are imported but unused if PlistBuddy handles both read and write — remove those two imports since `execFileSync` covers both Print and Set.

- [ ] **Step 2: Remove the unused imports**

Edit the file to drop the now-unused `readFileSync, writeFileSync` from the `fs` import:

```js
import { existsSync } from 'fs'
```

- [ ] **Step 3: Wire it as postinstall**

In `package.json`, add to `"scripts"`:

```json
"postinstall": "node scripts/rebrand-electron.mjs"
```

- [ ] **Step 4: Run it now and verify**

```bash
node scripts/rebrand-electron.mjs
/usr/libexec/PlistBuddy -c "Print :CFBundleName" node_modules/electron/dist/Electron.app/Contents/Info.plist
```

Expected output: `Huginn`.

- [ ] **Step 5: Verify idempotency**

```bash
node scripts/rebrand-electron.mjs
```

Expected: no error, and the log line ("Patched...") does NOT print a second time (early-return on already-`Huginn` check) — confirms re-running (as happens on every `npm install`) is safe.

- [ ] **Step 6: Manual verification**

Run `npm run dev`. Confirm the macOS menu bar (next to the apple logo) now shows "Huginn" instead of "Electron".

- [ ] **Step 7: Commit**

```bash
git add scripts/rebrand-electron.mjs package.json
git commit -m "Rebrand dev Electron.app bundle name to Huginn via postinstall"
```

---

### Task 3: electron-builder packaging config

**Files:**
- Modify: `package.json` (add devDependency, `build` config, `dist:*` scripts)

**Interfaces:**
- Produces: nothing consumed by later tasks — self-contained.

- [ ] **Step 1: Install electron-builder**

```bash
npm install --save-dev electron-builder
```

- [ ] **Step 2: Add packaging config to package.json**

Add a top-level `"build"` key (sibling to `"scripts"`, `"dependencies"`, etc.):

```json
"build": {
  "appId": "com.thomasbonnici.huginn",
  "productName": "Huginn",
  "icon": "icon.png",
  "directories": {
    "output": "release"
  },
  "files": [
    "out/**/*",
    "electron/mobileWeb/**/*"
  ],
  "mac": {
    "target": "dmg",
    "category": "public.app-category.developer-tools"
  },
  "linux": {
    "target": "deb",
    "category": "Development"
  }
}
```

`electron/mobileWeb/**/*` is included explicitly because `MobileServer` (`electron/mobile.ts:51`) reads those files from disk at runtime via `app.getAppPath()` + `readFileSync` — they need to ship as loose files alongside the bundled JS, not get swept into a bundle where `readFileSync` can't find them.

- [ ] **Step 3: Add build scripts**

Add to `"scripts"`:

```json
"dist:mac": "electron-vite build && electron-builder --mac",
"dist:linux": "electron-vite build && electron-builder --linux"
```

- [ ] **Step 4: Validate config shape**

```bash
node -e "const p = require('./package.json'); if (!p.build || !p.build.mac || !p.build.linux) throw new Error('build config missing'); console.log('OK')"
```

Expected output: `OK`. (Per your call, not running an actual `electron-builder` build tonight — this just confirms the JSON is well-formed and the config keys are present.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add electron-builder config for mac dmg and linux deb targets"
```

---

## Phase 2 — Menu overhaul, part A

### Task 4: preload.ts — new menu IPC bridges

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/types/api.d.ts`

**Interfaces:**
- Produces (preload API surface used by Tasks 6, 7, 8, 9's renderer wiring):
  - `onMenuOpenSettings(cb: () => void): () => void`
  - `onMenuNewFile(cb: () => void): () => void`
  - `onMenuNewFolder(cb: () => void): () => void`
  - `onMenuNewTerminal(cb: () => void): () => void`
  - `onMenuReopenClosedTab(cb: () => void): () => void`
  - `onMenuSave(cb: () => void): () => void`
  - `onMenuFind(cb: () => void): () => void`
  - `onMenuFindInFiles(cb: () => void): () => void`
  - `onMenuToggleSidebar(cb: () => void): () => void`
  - `onMenuCommandPalette(cb: () => void): () => void`
  - `onMenuActionPalette(cb: () => void): () => void`
  - `onMenuToggleClaudeChat(cb: () => void): () => void`

- [ ] **Step 1: Add the IPC bridge methods to preload.ts**

In `electron/preload.ts`, insert after the existing `onMenuResetZoom` block (after line 129, before the `devtoolsAttach` block):

```ts
  onMenuOpenSettings: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:openSettings', handler)
    return () => ipcRenderer.removeListener('menu:openSettings', handler)
  },
  onMenuNewFile: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:newFile', handler)
    return () => ipcRenderer.removeListener('menu:newFile', handler)
  },
  onMenuNewFolder: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:newFolder', handler)
    return () => ipcRenderer.removeListener('menu:newFolder', handler)
  },
  onMenuNewTerminal: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:newTerminal', handler)
    return () => ipcRenderer.removeListener('menu:newTerminal', handler)
  },
  onMenuReopenClosedTab: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:reopenClosedTab', handler)
    return () => ipcRenderer.removeListener('menu:reopenClosedTab', handler)
  },
  onMenuSave: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:save', handler)
    return () => ipcRenderer.removeListener('menu:save', handler)
  },
  onMenuFind: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:find', handler)
    return () => ipcRenderer.removeListener('menu:find', handler)
  },
  onMenuFindInFiles: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:findInFiles', handler)
    return () => ipcRenderer.removeListener('menu:findInFiles', handler)
  },
  onMenuToggleSidebar: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:toggleSidebar', handler)
    return () => ipcRenderer.removeListener('menu:toggleSidebar', handler)
  },
  onMenuCommandPalette: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:commandPalette', handler)
    return () => ipcRenderer.removeListener('menu:commandPalette', handler)
  },
  onMenuActionPalette: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:actionPalette', handler)
    return () => ipcRenderer.removeListener('menu:actionPalette', handler)
  },
  onMenuToggleClaudeChat: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:toggleClaudeChat', handler)
    return () => ipcRenderer.removeListener('menu:toggleClaudeChat', handler)
  },
```

- [ ] **Step 2: Add matching types to api.d.ts**

In `src/types/api.d.ts`, after the existing `onMenuResetZoom: (cb: () => void) => () => void` line (line 107), add:

```ts
      onMenuOpenSettings: (cb: () => void) => () => void
      onMenuNewFile: (cb: () => void) => () => void
      onMenuNewFolder: (cb: () => void) => () => void
      onMenuNewTerminal: (cb: () => void) => () => void
      onMenuReopenClosedTab: (cb: () => void) => () => void
      onMenuSave: (cb: () => void) => () => void
      onMenuFind: (cb: () => void) => () => void
      onMenuFindInFiles: (cb: () => void) => () => void
      onMenuToggleSidebar: (cb: () => void) => () => void
      onMenuCommandPalette: (cb: () => void) => () => void
      onMenuActionPalette: (cb: () => void) => () => void
      onMenuToggleClaudeChat: (cb: () => void) => () => void
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p tsconfig.web.json
```

Expected: no new errors (these methods aren't consumed yet, so nothing should reference them, but the declaration itself must compile cleanly).

- [ ] **Step 4: Commit**

```bash
git add electron/preload.ts src/types/api.d.ts
git commit -m "Add preload IPC bridges for new menu items"
```

---

### Task 5: sidebarUiStore — one-shot create trigger

**Files:**
- Create: `src/stores/sidebarUiStore.ts`
- Test: `src/stores/__tests__/sidebarUiStore.test.ts`
- Modify: `src/components/Sidebar/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces (consumed by Task 7's App.tsx wiring):
  - `useSidebarUiStore.getState().requestCreate(kind: 'file' | 'directory'): void`
  - `useSidebarUiStore((s) => s.pendingCreate): 'file' | 'directory' | null`

- [ ] **Step 1: Write the failing test**

Create `src/stores/__tests__/sidebarUiStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSidebarUiStore } from '../sidebarUiStore'

describe('sidebarUiStore', () => {
  beforeEach(() => {
    useSidebarUiStore.setState({ pendingCreate: null })
  })

  it('starts with no pending create', () => {
    expect(useSidebarUiStore.getState().pendingCreate).toBeNull()
  })

  it('requestCreate sets pendingCreate to the requested kind', () => {
    useSidebarUiStore.getState().requestCreate('file')
    expect(useSidebarUiStore.getState().pendingCreate).toBe('file')
  })

  it('clearPendingCreate resets to null', () => {
    useSidebarUiStore.getState().requestCreate('directory')
    useSidebarUiStore.getState().clearPendingCreate()
    expect(useSidebarUiStore.getState().pendingCreate).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/stores/__tests__/sidebarUiStore.test.ts
```

Expected: FAIL (module `../sidebarUiStore` not found).

- [ ] **Step 3: Write the store**

Create `src/stores/sidebarUiStore.ts`:

```ts
import { create } from 'zustand'

type CreateKind = 'file' | 'directory'

interface SidebarUiState {
  pendingCreate: CreateKind | null
  requestCreate: (kind: CreateKind) => void
  clearPendingCreate: () => void
}

export const useSidebarUiStore = create<SidebarUiState>((set) => ({
  pendingCreate: null,
  requestCreate: (kind) => set({ pendingCreate: kind }),
  clearPendingCreate: () => set({ pendingCreate: null }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/stores/__tests__/sidebarUiStore.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Wire Sidebar.tsx to consume it**

In `src/components/Sidebar/Sidebar.tsx`, add the import (near the other store imports, after line 5):

```ts
import { useSidebarUiStore } from '@/stores/sidebarUiStore'
```

Inside the `Sidebar()` function body, after the existing `startCreate` function definition (after line 141), add an effect that consumes a pending request once `projectRoot` is known and clears it:

```ts
  const pendingCreate = useSidebarUiStore((s) => s.pendingCreate)

  useEffect(() => {
    if (!pendingCreate || !projectRoot) return
    useSidebarUiStore.getState().clearPendingCreate()
    startCreate(pendingCreate, null)
  }, [pendingCreate, projectRoot])
```

Place the `useEffect` call itself among the component's other `useEffect` hooks (e.g., right after the one ending at line 89), not inline after the `startCreate` function definition — keeps all hooks grouped together per the file's existing convention. `startCreate('file'|'directory', null)` targets the project root (per `targetDirectory(null)` at line 117-121), matching "Create File"/"Create Directory" from the existing right-click-on-empty-space context menu path. If no project is open, the effect just waits (no project root, no-op) rather than firing into a null directory.

- [ ] **Step 6: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass, including the new sidebarUiStore tests and existing Sidebar-adjacent tests unaffected.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit -p tsconfig.web.json
```

- [ ] **Step 8: Commit**

```bash
git add src/stores/sidebarUiStore.ts src/stores/__tests__/sidebarUiStore.test.ts src/components/Sidebar/Sidebar.tsx
git commit -m "Add sidebarUiStore for menu-triggered file/folder creation"
```

---

### Task 6: main.ts — Part A menu items

**Files:**
- Modify: `electron/main.ts`

**Interfaces:**
- Consumes: nothing new (uses existing `BrowserWindow`, `Menu` imports already in the file).
- Produces: sends the IPC channels `menu:openSettings`, `menu:newFile`, `menu:newFolder`, `menu:newTerminal`, `menu:reopenClosedTab`, `menu:save`, `menu:find`, `menu:findInFiles`, `menu:toggleSidebar`, `menu:commandPalette`, `menu:actionPalette`, `menu:toggleClaudeChat` — consumed by Tasks 7 and 8.

- [ ] **Step 1: Rebind "Open Project…" and add File menu items**

In `electron/main.ts`, replace the `File` menu's `submenu` array (lines 132-149) with:

```ts
        submenu: [
          {
            label: 'New File',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:newFile')
            },
          },
          {
            label: 'New Folder',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:newFolder')
            },
          },
          {
            label: 'New Terminal',
            accelerator: 'CmdOrCtrl+T',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:newTerminal')
            },
          },
          { type: 'separator' },
          {
            label: 'Open Project…',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:openProject')
            },
          },
          { type: 'separator' },
          {
            label: 'Reopen Closed Tab',
            accelerator: 'CmdOrCtrl+Shift+T',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:reopenClosedTab')
            },
          },
          {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:save')
            },
          },
          { type: 'separator' },
          {
            label: 'Close Tab',
            accelerator: 'CmdOrCtrl+W',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:closeActiveTab')
            },
          },
          { role: 'close', label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W' },
        ],
```

(`role: 'close'` is a native Electron role — it already closes only the focused `BrowserWindow`, no custom `click` handler needed; label/accelerator can still be overridden alongside a role.) Note "New Window" and "Recent Projects" are deliberately **not** added here — they're Task 19 (Phase 4), once `createWindow()` supports being called more than once.

- [ ] **Step 2: Add Preferences to the Huginn menu**

Replace the `Huginn` menu's `submenu` array (lines 117-127) with:

```ts
        submenu: [
          { role: 'about' },
          {
            label: 'Preferences…',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:openSettings')
            },
          },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
```

- [ ] **Step 3: Add Find items to the Edit menu**

Replace the `Edit` menu's `submenu` array (lines 153-161) with:

```ts
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Find',
            accelerator: 'CmdOrCtrl+F',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:find')
            },
          },
          {
            label: 'Find in Files',
            accelerator: 'CmdOrCtrl+Shift+F',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:findInFiles')
            },
          },
        ],
```

- [ ] **Step 4: Add discoverability items to the View menu**

In the `View` menu's `submenu` array, insert a new block after the `togglefullscreen` separator group and before the existing zoom items — i.e., right after the `{ role: 'toggleDevTools' }` line and its following separator (lines 167-169), insert:

```ts
          {
            label: 'Toggle Sidebar',
            accelerator: 'CmdOrCtrl+B',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:toggleSidebar')
            },
          },
          {
            label: 'Command Palette…',
            accelerator: 'CmdOrCtrl+P',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:commandPalette')
            },
          },
          {
            label: 'Action Palette…',
            accelerator: 'CmdOrCtrl+Shift+P',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:actionPalette')
            },
          },
          {
            label: 'Toggle Claude Chat',
            accelerator: 'CmdOrCtrl+L',
            click: () => {
              const win = BrowserWindow.getFocusedWindow()
              if (win) win.webContents.send('menu:toggleClaudeChat')
            },
          },
          { type: 'separator' },
```

leaving the rest of the `View` submenu (the existing zoom items and `togglefullscreen`) unchanged below it.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit -p tsconfig.node.json
```

- [ ] **Step 6: Manual verification**

`npm run dev`, open the menu bar, confirm every new item listed above appears with the right label/accelerator/position, and that clicking each one doesn't throw (renderer wiring lands in Tasks 7-8, so clicks won't visibly *do* anything correct yet — just confirm no crash).

- [ ] **Step 7: Commit**

```bash
git add electron/main.ts
git commit -m "Add Part A menu items: Preferences, New File/Folder/Terminal, Find, view toggles"
```

---

### Task 7: App.tsx — wire new menu listeners, remove superseded raw shortcuts

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `window.api.onMenuOpenSettings`, `onMenuNewTerminal`, `onMenuReopenClosedTab`, `onMenuFind`, `onMenuFindInFiles`, `onMenuToggleSidebar`, `onMenuCommandPalette`, `onMenuActionPalette`, `onMenuToggleClaudeChat` (Task 4), `useSidebarUiStore.getState().requestCreate` (Task 5).

- [ ] **Step 1: Remove the superseded keydown branches**

In `src/App.tsx`, the keydown handler (lines 185-217) currently has branches for `b`, `p` (no shift), `f`, `shift+p`, `t` (no shift), `shift+t`, and `l`. Replace the whole handler body so only the `d`-unrelated... (there is no `d` branch here — that's in Editor.tsx, untouched) — remove every branch listed above, leaving the effect empty of keyboard-shortcut logic since all of them are being promoted to menu items:

```ts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Toggle Sidebar, Command Palette, Search, Action Palette, New Terminal,
      // Reopen Closed Tab, and Toggle Claude Chat are now driven exclusively by
      // native menu items (see the onMenu* effects below) — Electron's menu
      // accelerators consume the key event before it reaches this listener,
      // so keeping both would risk double-firing.
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
```

If this leaves the effect with an empty, unused `handler`, remove the whole `useEffect` block entirely instead (cleaner — don't leave a no-op listener registered). Check first whether any other logic shares this same `useEffect` block before deleting it wholesale (re-read the current file state, since line numbers shift after Task 5/6 edits to other files don't affect this one, but re-verify against the actual current content of this specific block before removing).

- [ ] **Step 2: Add the new menu-listener effects**

Immediately after the existing `onMenuResetZoom` effect (originally lines 271-276, in the same location relative to the other `onMenu*` effects), add:

```ts
  useEffect(() => {
    return window.api.onMenuOpenSettings(() => {
      setLeftPanel('settings')
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuNewFile(() => {
      useSidebarUiStore.getState().requestCreate('file')
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuNewFolder(() => {
      useSidebarUiStore.getState().requestCreate('directory')
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuNewTerminal(() => {
      openNewTerminal()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuReopenClosedTab(() => {
      useEditorStore.getState().reopenLastClosed()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuFind(() => {
      if (!useFileStore.getState().projectRoot) return
      useSearchStore.getState().openSearch(false)
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuFindInFiles(() => {
      if (!useFileStore.getState().projectRoot) return
      useSearchStore.getState().openSearch(true)
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuToggleSidebar(() => {
      setLeftPanel((p) => (p !== null ? null : lastLeftPanelRef.current))
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuCommandPalette(() => {
      if (!useFileStore.getState().projectRoot) return
      useSearchStore.getState().openCommandPalette()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuActionPalette(() => {
      useSearchStore.getState().openActionPalette()
    })
  }, [])

  useEffect(() => {
    return window.api.onMenuToggleClaudeChat(() => {
      useClaudeStore.getState().toggleChatVisible()
    })
  }, [])
```

Each effect mirrors exactly the logic the removed keydown branch used to run (same store calls, same guard conditions), so behavior is unchanged — only the trigger path moved from a raw key listener to the native menu.

- [ ] **Step 3: Add the sidebarUiStore import**

Near the top of `src/App.tsx`, alongside the other store imports (after the `useFontSizeStore`/`useInstanceFontSizeStore` imports around line 47-48), add:

```ts
import { useSidebarUiStore } from './stores/sidebarUiStore'
```

- [ ] **Step 4: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit -p tsconfig.web.json
```

- [ ] **Step 6: Manual verification**

`npm run dev`. Verify: `⌘,` opens Settings; `⌘N`/"New File" prompts a new-file input at project root; `⌘T` opens a new terminal tab; `⌘⇧T` reopens the last closed tab; `⌘F`/`⌘⇧F` open search; `⌘B` toggles the sidebar; `⌘P` opens the command palette; `⌘⇧P` opens the action palette; `⌘L` toggles the Claude chat panel. Confirm none of these double-fire (e.g., sidebar doesn't toggle twice on one `⌘B` press).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "Wire new menu items in App.tsx, remove superseded raw keyboard shortcuts"
```

---

### Task 8: Editor.tsx — wire Save menu item, remove raw Save shortcut

**Files:**
- Modify: `src/components/Editor/Editor.tsx`

**Interfaces:**
- Consumes: `window.api.onMenuSave` (Task 4).

- [ ] **Step 1: Remove the `s` branch from the keydown handler**

In `src/components/Editor/Editor.tsx`, in the keydown handler (around lines 93-104), remove only the `key === 's'` branch, keeping the `key === 'd'` (split pane) branch untouched:

```ts
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return

      const key = e.key.toLowerCase()

      if (key === 'd') {
        e.preventDefault()
        splitActivePane(e.shiftKey ? 'vertical' : 'horizontal')
      }
    }
```

- [ ] **Step 2: Add a menu-listener effect for Save**

Add a new `useEffect` alongside the existing keydown-registration effect (after it, still inside the `Editor()` component body):

```ts
  useEffect(() => {
    return window.api.onMenuSave(() => {
      saveActiveTab({ allowCreateMissing: true })
    })
  }, [])
```

- [ ] **Step 3: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit -p tsconfig.web.json
```

- [ ] **Step 5: Manual verification**

`npm run dev`, edit a file, use `⌘S` (now routed through the menu) and confirm it saves exactly once (check the tab's dirty indicator clears, and that the file's on-disk content updated) — not twice, not zero times.

- [ ] **Step 6: Commit**

```bash
git add src/components/Editor/Editor.tsx
git commit -m "Wire Save menu item in Editor.tsx, remove superseded raw shortcut"
```

---

## Phase 3 — Multi-window backend

This phase converts six manager classes from "one instance per app-start, bound to one captured `win`" to "one instance app-wide, `registerHandlers()` called exactly once, per-window state in a `Map<number, ...>` keyed by `BrowserWindow.fromWebContents(event.sender).id`." Every task in this phase follows the same shape; Task 9 (PtyManager) is written in the most detail as the reference implementation.

### Task 9: PtyManager — per-window isolation

**Files:**
- Modify: `electron/pty.ts`
- Create: `electron/__tests__/pty.test.ts`

**Interfaces:**
- Produces: `PtyManager.registerHandlers(): void` (called once), `PtyManager.disposeWindow(winId: number): void` (called from Task 15's window-close handler). Constructor takes no arguments (was `constructor(win: BrowserWindow)`).

- [ ] **Step 1: Write the failing isolation test**

Create `electron/__tests__/pty.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { handlers, spawnMock } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
  spawnMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
    on: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
  },
}))

vi.mock('node-pty', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}))

import { PtyManager } from '../pty'

function fakeWin(id: number) {
  return { id, webContents: { send: vi.fn() } }
}

function fakePty() {
  return { onData: vi.fn(), onExit: vi.fn(), kill: vi.fn(), write: vi.fn(), resize: vi.fn() }
}

describe('PtyManager multi-window isolation', () => {
  beforeEach(() => {
    spawnMock.mockReset()
  })

  it('spawning a terminal with the same id in two different windows creates two independent processes', () => {
    const manager = new PtyManager()
    manager.registerHandlers()
    const winA = fakeWin(1)
    const winB = fakeWin(2)
    const procA = fakePty()
    const procB = fakePty()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)

    handlers['term:spawn']({ sender: winA }, 'term-1', '/project/a')
    handlers['term:spawn']({ sender: winB }, 'term-1', '/project/b')

    expect(spawnMock).toHaveBeenCalledTimes(2)
    expect(spawnMock.mock.calls[1][2]).toMatchObject({ cwd: '/project/b' })
  })

  it('writing to a terminal in window A does not affect window B\'s same-id process', () => {
    const manager = new PtyManager()
    manager.registerHandlers()
    const winA = fakeWin(1)
    const winB = fakeWin(2)
    const procA = fakePty()
    const procB = fakePty()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)

    handlers['term:spawn']({ sender: winA }, 'term-1', '/project/a')
    handlers['term:spawn']({ sender: winB }, 'term-1', '/project/b')
    handlers['term:write']({ sender: winA }, 'term-1', 'echo hi\n')

    expect(procA.write).toHaveBeenCalledWith('echo hi\n')
    expect(procB.write).not.toHaveBeenCalled()
  })

  it('disposeWindow kills only that window\'s processes', () => {
    const manager = new PtyManager()
    manager.registerHandlers()
    const winA = fakeWin(1)
    const winB = fakeWin(2)
    const procA = fakePty()
    const procB = fakePty()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)

    handlers['term:spawn']({ sender: winA }, 'term-1', '/project/a')
    handlers['term:spawn']({ sender: winB }, 'term-1', '/project/b')
    manager.disposeWindow(1)

    expect(procA.kill).toHaveBeenCalled()
    expect(procB.kill).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run electron/__tests__/pty.test.ts
```

Expected: FAIL — `new PtyManager()` doesn't match the current `constructor(win: BrowserWindow)` signature, and `disposeWindow` doesn't exist yet.

- [ ] **Step 3: Rewrite pty.ts**

Replace the full contents of `electron/pty.ts`:

```ts
import { BrowserWindow, ipcMain } from 'electron'
import * as pty from 'node-pty'
import { platform } from 'os'

const shell =
  platform() === 'win32'
    ? 'powershell.exe'
    : process.env.SHELL ?? '/bin/zsh'

function hasValidSize(cols: number, rows: number): boolean {
  return Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0
}

interface WindowState {
  procs: Map<string, pty.IPty>
  killedIds: Set<string> // tracks intentional kills
}

export class PtyManager {
  private byWindow = new Map<number, WindowState>()

  registerHandlers(): void {
    ipcMain.handle('term:spawn', (event, id: string, cwd?: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      const state = this.stateFor(win.id)
      if (state.procs.has(id)) return

      // Electron's own process env sometimes carries an EDITOR/VISUAL set by
      // whatever dev tooling launched it (e.g. "vi"), not by the user's shell
      // profile. zsh auto-switches its line editor into vi mode whenever
      // $VISUAL/$EDITOR ends in "vi", which silently drops the emacs-style
      // bindings readline users expect (Ctrl+R history search, Ctrl+A/E
      // line navigation — Ctrl+C still works since SIGINT is a TTY signal,
      // not a keymap binding). Stripping these lets the shell fall back to
      // its normal interactive default instead of inheriting Electron's.
      const env = { ...(process.env as Record<string, string>) }
      delete env.EDITOR
      delete env.VISUAL
      const proc = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: cwd ?? process.env.HOME,
        env,
      })
      state.procs.set(id, proc)
      proc.onData((data) => {
        if (!win.isDestroyed()) win.webContents.send('term:data', id, data)
      })
      proc.onExit(() => {
        if (state.killedIds.has(id)) {
          state.killedIds.delete(id) // intentional kill — no notification
          return
        }
        state.procs.delete(id)
        if (!win.isDestroyed()) win.webContents.send('term:exit', id)
      })
    })

    ipcMain.handle('term:kill', (event, id: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      const state = this.stateFor(win.id)
      const proc = state.procs.get(id)
      if (!proc) return
      state.killedIds.add(id) // mark as intentional before kill fires onExit
      state.procs.delete(id)
      proc.kill()
    })

    ipcMain.on('term:write', (event, id: string, data: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      this.stateFor(win.id).procs.get(id)?.write(data)
    })

    ipcMain.on('term:resize', (event, id: string, cols: number, rows: number) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win || !hasValidSize(cols, rows)) return
      this.stateFor(win.id).procs.get(id)?.resize(Math.floor(cols), Math.floor(rows))
    })
  }

  private stateFor(winId: number): WindowState {
    let state = this.byWindow.get(winId)
    if (!state) {
      state = { procs: new Map(), killedIds: new Set() }
      this.byWindow.set(winId, state)
    }
    return state
  }

  disposeWindow(winId: number): void {
    const state = this.byWindow.get(winId)
    if (!state) return
    for (const proc of state.procs.values()) proc.kill()
    this.byWindow.delete(winId)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run electron/__tests__/pty.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.node.json
```

Expected: errors in `electron/main.ts` where `new PtyManager(win)` is still called with the old one-argument signature — that's expected and gets fixed in Task 15; do not modify `main.ts` in this task.

- [ ] **Step 7: Commit**

```bash
git add electron/pty.ts electron/__tests__/pty.test.ts
git commit -m "Convert PtyManager to per-window isolation"
```

---

### Task 10: ClaudeManager — per-window isolation

**Files:**
- Modify: `electron/claude.ts`
- Modify: `electron/__tests__/claude.test.ts`

**Interfaces:**
- Produces: `ClaudeManager.registerHandlers(): void` (called once), `ClaudeManager.disposeWindow(winId: number): void`. Constructor takes no arguments.

- [ ] **Step 1: Rewrite the existing test to the new mock/window pattern**

Replace the full contents of `electron/__tests__/claude.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { handlers, spawnMock } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
  spawnMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
    on: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
  },
}))

vi.mock('node-pty', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}))

import { ClaudeManager } from '../claude'

function fakeWin(id: number) {
  return { id, webContents: { send: vi.fn() } }
}

function fakePty() {
  return {
    onData: vi.fn(),
    onExit: vi.fn(),
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
  }
}

describe('ClaudeManager assistant:spawn (attach mode)', () => {
  beforeEach(() => {
    spawnMock.mockReset()
  })

  function setup() {
    const manager = new ClaudeManager()
    manager.registerHandlers()
    return { manager, spawnHandler: handlers['assistant:spawn'] }
  }

  it('reuses the existing process when re-attaching with the same cwd', () => {
    const { spawnHandler } = setup()
    const win = fakeWin(1)
    const proc = fakePty()
    spawnMock.mockReturnValueOnce(proc)

    spawnHandler({ sender: win }, '/project/a', 'claude', undefined)
    spawnHandler({ sender: win }, '/project/a', 'claude', undefined)

    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(proc.kill).not.toHaveBeenCalled()
  })

  it('spawns a fresh process rooted in the new cwd when the project folder changes', () => {
    const { spawnHandler } = setup()
    const win = fakeWin(1)
    const procA = fakePty()
    const procB = fakePty()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)

    spawnHandler({ sender: win }, '/project/a', 'claude', undefined)
    spawnHandler({ sender: win }, '/project/b', 'claude', undefined)

    expect(spawnMock).toHaveBeenCalledTimes(2)
    expect(spawnMock.mock.calls[1][2]).toMatchObject({ cwd: '/project/b' })
    expect(procA.kill).toHaveBeenCalled()
  })

  it('keeps window A\'s assistant process running independent of window B', () => {
    const { spawnHandler } = setup()
    const winA = fakeWin(1)
    const winB = fakeWin(2)
    const procA = fakePty()
    const procB = fakePty()
    spawnMock.mockReturnValueOnce(procA).mockReturnValueOnce(procB)

    spawnHandler({ sender: winA }, '/project/a', 'claude', undefined)
    spawnHandler({ sender: winB }, '/project/b', 'claude', undefined)

    expect(procA.kill).not.toHaveBeenCalled()
    expect(procB.kill).not.toHaveBeenCalled()
    expect(spawnMock).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run electron/__tests__/claude.test.ts
```

Expected: FAIL — `new ClaudeManager()` doesn't match the current `constructor(win: BrowserWindow)` signature.

- [ ] **Step 3: Rewrite claude.ts**

Replace the full contents of `electron/claude.ts`:

```ts
import { BrowserWindow, ipcMain } from 'electron'
import * as pty from 'node-pty'

type AssistantKind = 'claude' | 'codex'
type SessionMode = 'attach' | 'new' | 'continue'

const COMMANDS: Record<AssistantKind, Record<Exclude<SessionMode, 'attach'>, string>> = {
  claude: {
    new: 'claude',
    continue: 'claude --continue',
  },
  codex: {
    new: 'codex',
    continue: 'codex resume --last',
  },
}

const INSTALL_MESSAGES: Record<AssistantKind, string> = {
  claude: "Install it with: npm install -g @anthropic-ai/claude-code",
  codex: 'Install Codex CLI, then make sure `codex` is available in PATH.',
}

function hasValidSize(cols: number, rows: number): boolean {
  return Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0
}

interface WindowState {
  procs: Partial<Record<AssistantKind, pty.IPty>>
  procCwd: Partial<Record<AssistantKind, string>>
  activeAssistant: AssistantKind
}

export class ClaudeManager {
  private byWindow = new Map<number, WindowState>()

  registerHandlers(): void {
    ipcMain.handle('assistant:spawn', (event, cwd: string, assistant: AssistantKind = 'claude', mode: SessionMode = 'attach') => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      const state = this.stateFor(win.id)
      const selectedAssistant = assistant === 'codex' ? 'codex' : 'claude'
      const selectedMode = mode === 'continue' || mode === 'new' ? mode : 'attach'
      state.activeAssistant = selectedAssistant

      const attachingToSameCwd = state.procs[selectedAssistant] && state.procCwd[selectedAssistant] === cwd
      if (selectedMode === 'attach' && attachingToSameCwd) return

      state.procs[selectedAssistant]?.kill()
      delete state.procs[selectedAssistant]
      delete state.procCwd[selectedAssistant]

      try {
        const shell = process.env.SHELL ?? '/bin/zsh'
        const command = COMMANDS[selectedAssistant][selectedMode === 'attach' ? 'new' : selectedMode]
        const proc = pty.spawn(shell, ['-lic', command], {
          name: 'xterm-color',
          cols: 80,
          rows: 24,
          cwd,
          env: process.env as Record<string, string>,
        })
        state.procs[selectedAssistant] = proc
        state.procCwd[selectedAssistant] = cwd
        proc.onData((data) => {
          if (!win.isDestroyed()) win.webContents.send('assistant:data', selectedAssistant, data)
        })
        proc.onExit(() => {
          if (state.procs[selectedAssistant] === proc) {
            delete state.procs[selectedAssistant]
            delete state.procCwd[selectedAssistant]
          }
        })
      } catch {
        if (!win.isDestroyed()) {
          win.webContents.send(
            'assistant:data',
            selectedAssistant,
            `\r\nError: '${selectedAssistant}' not found in PATH.\r\n${INSTALL_MESSAGES[selectedAssistant]}\r\n`
          )
        }
      }
    })

    ipcMain.on('assistant:write', (event, assistant: AssistantKind | undefined, data: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      const state = this.stateFor(win.id)
      const selectedAssistant = (assistant === 'codex' ? 'codex' : assistant === 'claude' ? 'claude' : state.activeAssistant)
      state.procs[selectedAssistant]?.write(data)
    })

    ipcMain.on('assistant:resize', (event, assistant: AssistantKind | undefined, cols: number, rows: number) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win || !hasValidSize(cols, rows)) return
      const state = this.stateFor(win.id)
      const selectedAssistant = (assistant === 'codex' ? 'codex' : assistant === 'claude' ? 'claude' : state.activeAssistant)
      state.procs[selectedAssistant]?.resize(Math.floor(cols), Math.floor(rows))
    })
  }

  private stateFor(winId: number): WindowState {
    let state = this.byWindow.get(winId)
    if (!state) {
      state = { procs: {}, procCwd: {}, activeAssistant: 'claude' }
      this.byWindow.set(winId, state)
    }
    return state
  }

  disposeWindow(winId: number): void {
    const state = this.byWindow.get(winId)
    if (!state) return
    Object.values(state.procs).forEach((proc) => proc?.kill())
    this.byWindow.delete(winId)
  }
}
```

Note: the original `assistant:write`/`assistant:resize` handlers had `assistant: AssistantKind = this.activeAssistant` as a parameter default — that referenced a single shared `this.activeAssistant`. With per-window `activeAssistant`, the default can no longer be evaluated as a parameter default (it depends on which window's state applies, known only inside the handler body) — reworked above to resolve it from `state.activeAssistant` inside the handler instead. This is a real behavior-preserving fix, not an incidental change: it makes "assistant" defaulting correctly per-window instead of (previously, accidentally correct only because there was one window) globally.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run electron/__tests__/claude.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.node.json
```

Expected: error in `electron/main.ts` (`new ClaudeManager(win)`) — expected, fixed in Task 15.

- [ ] **Step 7: Commit**

```bash
git add electron/claude.ts electron/__tests__/claude.test.ts
git commit -m "Convert ClaudeManager to per-window isolation"
```

---

### Task 11: GitWatcher — per-window isolation

**Files:**
- Modify: `electron/gitWatcher.ts`
- Create: `electron/__tests__/gitWatcher.test.ts`

**Interfaces:**
- Produces: `GitWatcher.registerHandlers(): void` (called once), `GitWatcher.disposeWindow(winId: number): void`. Constructor takes no arguments.

- [ ] **Step 1: Write the failing isolation test**

Create `electron/__tests__/gitWatcher.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { handlers, watchMock, watcherInstances } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
  watchMock: vi.fn(),
  watcherInstances: [] as any[],
}))

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
  },
}))

vi.mock('fs', () => ({ existsSync: () => true }))

vi.mock('chokidar', () => ({
  watch: (...args: unknown[]) => {
    watchMock(...args)
    const instance = { on: vi.fn(), close: vi.fn() }
    watcherInstances.push(instance)
    return instance
  },
}))

import { GitWatcher } from '../gitWatcher'

function fakeWin(id: number) {
  return { id, webContents: { send: vi.fn() } }
}

describe('GitWatcher multi-window isolation', () => {
  beforeEach(() => {
    watchMock.mockReset()
    watcherInstances.length = 0
  })

  it('watching different roots in two windows creates two independent watchers', () => {
    const manager = new GitWatcher()
    manager.registerHandlers()
    const winA = fakeWin(1)
    const winB = fakeWin(2)

    handlers['git:watchRoot']({ sender: winA }, '/project/a')
    handlers['git:watchRoot']({ sender: winB }, '/project/b')

    expect(watchMock).toHaveBeenCalledTimes(2)
  })

  it('disposeWindow closes only that window\'s watcher', () => {
    const manager = new GitWatcher()
    manager.registerHandlers()
    const winA = fakeWin(1)
    const winB = fakeWin(2)

    handlers['git:watchRoot']({ sender: winA }, '/project/a')
    handlers['git:watchRoot']({ sender: winB }, '/project/b')
    manager.disposeWindow(1)

    expect(watcherInstances[0].close).toHaveBeenCalled()
    expect(watcherInstances[1].close).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run electron/__tests__/gitWatcher.test.ts
```

Expected: FAIL — `new GitWatcher()` doesn't match the current `constructor(win: BrowserWindow)` signature.

- [ ] **Step 3: Rewrite gitWatcher.ts**

Replace the full contents of `electron/gitWatcher.ts`:

```ts
import { BrowserWindow, ipcMain } from 'electron'
import { watch, type FSWatcher } from 'chokidar'
import { existsSync } from 'fs'
import { join } from 'path'

interface WindowState {
  watcher: FSWatcher | null
  debounceTimer: ReturnType<typeof setTimeout> | null
  cwd: string | null
}

// Renderer only learns about git state changes it caused itself (staging,
// committing, etc. through the UI) or on window focus. Commands run directly
// in the integrated terminal (checkout, commit, pull, merge...) never trigger
// either path, so the status bar goes stale. Watching the handful of files
// git itself mutates on any state change lets us push a refresh regardless of
// where the command came from.
export class GitWatcher {
  private byWindow = new Map<number, WindowState>()

  registerHandlers(): void {
    ipcMain.on('git:watchRoot', (event, cwd: string | null) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      if (cwd) this.watchRoot(win, cwd)
      else this.stop(win.id)
    })
  }

  private watchRoot(win: BrowserWindow, cwd: string): void {
    const state = this.stateFor(win.id)
    if (state.cwd === cwd && state.watcher) return
    this.stop(win.id)

    const gitDir = join(cwd, '.git')
    if (!existsSync(gitDir)) return

    const freshState = this.stateFor(win.id)
    freshState.cwd = cwd
    freshState.watcher = watch(
      [
        join(gitDir, 'HEAD'),
        join(gitDir, 'MERGE_HEAD'),
        join(gitDir, 'index'),
        join(gitDir, 'packed-refs'),
        join(gitDir, 'refs'),
      ],
      { ignoreInitial: true, depth: 5 }
    )
    freshState.watcher.on('all', () => this.notifyChanged(win, cwd))
    freshState.watcher.on('error', (err) => console.error('GitWatcher error:', err))
  }

  private notifyChanged(win: BrowserWindow, cwd: string): void {
    const state = this.stateFor(win.id)
    if (state.debounceTimer) clearTimeout(state.debounceTimer)
    state.debounceTimer = setTimeout(() => {
      if (!win.isDestroyed()) win.webContents.send('git:changed', cwd)
    }, 300)
  }

  private stateFor(winId: number): WindowState {
    let state = this.byWindow.get(winId)
    if (!state) {
      state = { watcher: null, debounceTimer: null, cwd: null }
      this.byWindow.set(winId, state)
    }
    return state
  }

  private stop(winId: number): void {
    const state = this.byWindow.get(winId)
    if (!state) return
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer)
      state.debounceTimer = null
    }
    state.watcher?.close()
    state.watcher = null
    state.cwd = null
  }

  disposeWindow(winId: number): void {
    this.stop(winId)
    this.byWindow.delete(winId)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run electron/__tests__/gitWatcher.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.node.json
```

Expected: error in `electron/main.ts` (`new GitWatcher(win)`) — expected, fixed in Task 15.

- [ ] **Step 7: Commit**

```bash
git add electron/gitWatcher.ts electron/__tests__/gitWatcher.test.ts
git commit -m "Convert GitWatcher to per-window isolation"
```

---

### Task 12: GitRunner — per-window isolation

**Files:**
- Modify: `electron/gitRunner.ts`
- Modify: `electron/__tests__/git.test.ts`

**Interfaces:**
- Produces: `GitRunner.registerHandlers(): void` (called once). Constructor takes no arguments. (No `disposeWindow` needed — `git` subprocesses are short-lived and self-clean via their own `close` handler; only the `running` flag is per-window state, and a `Map` entry left behind after a window closes is harmless since it's never read again.)

- [ ] **Step 1: Update the existing GitRunner tests to the new mock/window pattern**

In `electron/__tests__/git.test.ts`, the `describe('GitRunner', ...)` block (starting at line 114) needs its `vi.mock('electron', ...)` (top of file, lines 7-15) extended with a `BrowserWindow` mock, and its `beforeEach` setup changed to use a fake-window-as-sender pattern. Replace the top-of-file `vi.mock('electron', ...)` block:

```ts
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      ipcHandlers[channel] = fn
    },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
  },
}))
```

Replace the `describe('GitRunner', ...)` block's `beforeEach` and every `ipcHandlers['git:runCommand'](...)` call site (there are 6+ call sites in this block — every one currently passes `{}` as the first argument):

```ts
describe('GitRunner', () => {
  let sends: { channel: string; args: unknown[] }[]
  let win: { id: number; webContents: { send: (...a: unknown[]) => void } }

  beforeEach(async () => {
    for (const key of Object.keys(ipcHandlers)) {
      delete ipcHandlers[key]
    }
    sends = []
    spawnMock.mockReset()
    win = { id: 1, webContents: { send: (...a) => sends.push({ channel: a[0] as string, args: a.slice(1) }) } }
    vi.resetModules()
    const { GitRunner } = await import('../gitRunner')
    new GitRunner().registerHandlers()
  })
```

Then change every subsequent `ipcHandlers['git:runCommand']({}, ...)` call in this `describe` block to `ipcHandlers['git:runCommand']({ sender: win }, ...)` — i.e. replace the first argument `{}` with `{ sender: win }` at each call site (the "spawns git with correct args for push" test, "…for forcePush", "…for forcePushLease", "streams stdout…", "streams stderr…", "sends git:log:exit…", "sends a synthetic failing exit if a command is already running", and any further tests in this block below what was shown).

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run electron/__tests__/git.test.ts
```

Expected: FAIL — `new GitRunner()` doesn't match the current `constructor(win: BrowserWindow)` signature.

- [ ] **Step 3: Rewrite gitRunner.ts**

Replace the full contents of `electron/gitRunner.ts`:

```ts
import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import type { GitCommandAction } from '../src/types/index'
import { getGitBranch, getGitBranches, getAheadBehind, getGitStatus, stageFiles, unstageFiles, stageAll, unstageAll, commit, discardFileChanges, getDiffContent, getGitGraph, getGitBranchDiff, getGitShowStat } from './git'

const ARGS: Record<GitCommandAction, string[]> = {
  fetch:           ['fetch'],
  pull:            ['pull'],
  push:            ['push'],
  forcePush:       ['push', '--force'],
  forcePushLease:  ['push', '--force-with-lease'],
}

export class GitRunner {
  private runningByWindow = new Map<number, boolean>()

  registerHandlers(): void {
    ipcMain.handle('git:runCommand', (event, id: string, cwd: string, action: GitCommandAction) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      if (this.runningByWindow.get(win.id)) {
        win.webContents.send('git:log:data', id, 'A git command is already running.\n')
        win.webContents.send('git:log:exit', id, 1)
        return
      }

      this.runningByWindow.set(win.id, true)
      const proc = spawn('git', ARGS[action], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })

      proc.stdout.on('data', (chunk: Buffer) => {
        if (!win.isDestroyed()) win.webContents.send('git:log:data', id, chunk.toString())
      })
      proc.stderr.on('data', (chunk: Buffer) => {
        if (!win.isDestroyed()) win.webContents.send('git:log:data', id, chunk.toString())
      })
      proc.on('close', (code: number | null) => {
        this.runningByWindow.set(win.id, false)
        if (!win.isDestroyed()) win.webContents.send('git:log:exit', id, code ?? 1)
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
    ipcMain.handle('git:discard', (_e, cwd: string, path: string) => discardFileChanges(cwd, path))
    ipcMain.handle('git:commit', (_e, cwd: string, message: string) => commit(cwd, message))
    ipcMain.handle('git:diff', (_e, cwd: string, path: string, staged: boolean) => getDiffContent(cwd, path, staged))
    ipcMain.handle('git:graph', (_e, cwd: string) => getGitGraph(cwd))
    ipcMain.handle('git:branches', (_e, cwd: string) => getGitBranches(cwd))
    ipcMain.handle('git:branchDiff', (_e, cwd: string, source: string, target: string) => getGitBranchDiff(cwd, source, target))
    ipcMain.handle('git:showStat', (_e, cwd: string, hash: string) => getGitShowStat(cwd, hash))
  }
}
```

The other `git:*` handlers (branch/status/stage/etc.) were never window-scoped in the first place — they're one-shot request/response calls keyed entirely by the `cwd` argument passed in, with no push events and no shared mutable state — so they need no change at all beyond staying inside the same `registerHandlers()` (still called exactly once, same as before).

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run electron/__tests__/git.test.ts
```

Expected: PASS (all `parsePorcelainStatus` tests plus all `GitRunner` tests).

- [ ] **Step 5: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.node.json
```

Expected: error in `electron/main.ts` (`new GitRunner(win)`) — expected, fixed in Task 15.

- [ ] **Step 7: Commit**

```bash
git add electron/gitRunner.ts electron/__tests__/git.test.ts
git commit -m "Convert GitRunner to per-window isolation"
```

---

### Task 13: CosmosManager — per-window isolation

**Files:**
- Modify: `electron/cosmos.ts`
- Modify: `electron/__tests__/cosmos.test.ts`

**Interfaces:**
- Produces: `CosmosManager.registerHandlers(): void` (called once), `CosmosManager.disposeWindow(winId: number): void`. Constructor takes no arguments.

- [ ] **Step 1: Update the existing tests to the new mock/window pattern**

In `electron/__tests__/cosmos.test.ts`, replace the top-of-file `vi.mock('electron', ...)` block (lines 7-16):

```ts
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
    on: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
  },
}))
```

Replace the `setup()` helper (lines 43-48):

```ts
  function setup() {
    const win = { id: 1, webContents: { send: vi.fn() } }
    const manager = new CosmosManager()
    manager.registerHandlers()
    return { win, sendHandler: handlers['cosmos:send'] }
  }
```

Then update every call site in this file that invokes `sendHandler({}, ...)` to `sendHandler({ sender: win }, ...)` — the first argument changes from an empty object to `{ sender: win }` throughout the file (there will be several `it(...)` blocks beyond the two shown earlier in this plan's exploration — apply the same substitution to all of them). Also update the `cosmos:cancel`/`cosmos:approve`/`cosmos:reject` handler call sites the same way if any test in the file invokes them directly (search the file for `handlers['cosmos:` to find every call site).

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run electron/__tests__/cosmos.test.ts
```

Expected: FAIL — `new CosmosManager()` doesn't match the current `constructor(win: BrowserWindow)` signature.

- [ ] **Step 3: Rewrite cosmos.ts's class body**

`electron/cosmos.ts` is a large file (680 lines), but only the `CosmosManager` class itself (lines 342-680) needs to change — every function above it (`parseSSEChunk`, `COSMOS_TOOLS`, `extractTextToolCalls`, `buildSystemPrompt`, etc.) is unchanged, pure, stateless, and already takes `cwd` as an explicit parameter. Replace only the `export class CosmosManager { ... }` block (lines 342-680) with:

```ts
export class CosmosManager {
  private controllerByWindow = new Map<number, AbortController>()
  private pendingApprovalsByWindow = new Map<number, Map<string, (approved: boolean) => void>>()
  private cancelledByWindow = new Map<number, boolean>()

  registerHandlers(): void {
    ipcMain.on('cosmos:send', (event, payload: CosmosSendPayload) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      // Returning the promise (instead of `void`-discarding it) is what lets
      // tests capture and await it via the mocked ipcMain.on handler map —
      // Electron itself ignores the return value either way.
      return this.runConversation(win, payload)
    })

    ipcMain.on('cosmos:cancel', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      this.controllerByWindow.get(win.id)?.abort()
      this.cancelledByWindow.set(win.id, true)
      const approvals = this.approvalsFor(win.id)
      for (const resolve of approvals.values()) {
        resolve(false)
      }
      approvals.clear()
    })

    ipcMain.on('cosmos:approve', (event, toolCallId: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      const approvals = this.approvalsFor(win.id)
      approvals.get(toolCallId)?.(true)
      approvals.delete(toolCallId)
    })

    ipcMain.on('cosmos:reject', (event, toolCallId: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return
      const approvals = this.approvalsFor(win.id)
      approvals.get(toolCallId)?.(false)
      approvals.delete(toolCallId)
    })

    ipcMain.handle('cosmos:testConnection', async (_event, settings: CosmosSettings) => {
      try {
        const response = await fetch(`${settings.endpoint}/models`, {
          headers: { Authorization: `Bearer ${settings.apiKey}` },
        })
        if (!response.ok) return { ok: false, error: `HTTP ${response.status}` }
        return { ok: true }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    })
  }

  private approvalsFor(winId: number): Map<string, (approved: boolean) => void> {
    let approvals = this.pendingApprovalsByWindow.get(winId)
    if (!approvals) {
      approvals = new Map()
      this.pendingApprovalsByWindow.set(winId, approvals)
    }
    return approvals
  }

  private emit(win: BrowserWindow, event: CosmosEvent): void {
    if (!win.isDestroyed()) win.webContents.send('cosmos:event', event)
  }

  private async runConversation(win: BrowserWindow, payload: CosmosSendPayload): Promise<void> {
    this.cancelledByWindow.set(win.id, false)
    const { cwd, settings, agentMode } = payload
    const messages = [...payload.messages]
    if (messages[0]?.role !== 'system') {
      messages.unshift({ role: 'system', content: await buildSystemPrompt(cwd) })
    }

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (round > 0) this.emit(win, { type: 'new-turn' })
      const streamResult = await this.streamOneCompletion(win, messages, settings)
      if (streamResult === null) return // error or abort already emitted

      if (streamResult.toolCalls.length === 0) {
        this.emit(win, { type: 'done' })
        return
      }

      messages.push({
        role: 'assistant',
        content: streamResult.content || null,
        tool_calls: streamResult.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      })

      for (const call of streamResult.toolCalls) {
        this.emit(win, { type: 'tool-call', id: call.id, name: call.name, args: call.args })
        const approved = agentMode ? true : await this.awaitApproval(win, call)
        const execResult = approved
          ? await this.executeTool(call.name, call.args, cwd)
          : { result: 'Rejected by user.', isError: true }

        this.emit(win, { type: 'tool-result', id: call.id, result: execResult.result, isError: execResult.isError })
        messages.push({ role: 'tool', tool_call_id: call.id, content: execResult.result })

        if (this.cancelledByWindow.get(win.id)) return
      }

      if (this.cancelledByWindow.get(win.id)) return
    }

    this.emit(win, { type: 'error', message: `Cosmos hit the ${MAX_TOOL_ROUNDS} tool-call round limit for this turn` })
  }

  private awaitApproval(win: BrowserWindow, call: PendingToolCall): Promise<boolean> {
    this.emit(win, { type: 'need-approval', id: call.id, name: call.name, args: call.args })
    return new Promise((resolve) => {
      this.approvalsFor(win.id).set(call.id, resolve)
    })
  }

  private async executeTool(name: string, args: Record<string, unknown>, cwd: string): Promise<ToolExecutionResult> {
    try {
      switch (name) {
        case 'read_file': {
          const content = await readFile(args.path as string, 'utf-8')
          const { startLine, endLine } = args as { startLine?: number; endLine?: number }
          if (startLine === undefined && endLine === undefined) {
            return { result: content, isError: false }
          }
          const lines = content.split('\n')
          const start = Math.max(1, startLine ?? 1)
          const end = Math.min(lines.length, endLine ?? lines.length)
          return { result: lines.slice(start - 1, end).join('\n'), isError: false }
        }
        case 'write_file': {
          await writeFile(args.path as string, args.content as string, 'utf-8')
          return { result: `Wrote ${(args.content as string).length} bytes to ${args.path}`, isError: false }
        }
        case 'list_dir': {
          const entries = await buildTree(args.path as string)
          return { result: JSON.stringify(entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory }))), isError: false }
        }
        case 'grep_search': {
          const matches = await searchText(args.root as string, args.query as string, Boolean(args.caseSensitive))
          return { result: JSON.stringify(matches), isError: false }
        }
        case 'run_command': {
          try {
            const { stdout, stderr } = await execFileAsync('/bin/zsh', ['-lc', args.command as string], {
              cwd,
              timeout: 60_000,
              maxBuffer: 10 * 1024 * 1024,
            })
            return { result: `${stdout}${stderr}`.trim() || '(no output)', isError: false }
          } catch (err) {
            const e = err as { stdout?: string; stderr?: string; message: string }
            return { result: `${e.stdout ?? ''}${e.stderr ?? ''}\n${e.message}`.trim(), isError: true }
          }
        }
        case 'edit_file': {
          const path = args.path as string
          const oldString = args.old_string as string
          const newString = args.new_string as string
          const content = await readFile(path, 'utf-8')
          const occurrences = content.split(oldString).length - 1
          if (occurrences === 0) {
            const firstKeyword = oldString.trim().split('\n')[0].trim().slice(0, 40)
            const lines = content.split('\n')
            const nearIdx = lines.findIndex(l => l.includes(firstKeyword.slice(0, 25)))
            const section = nearIdx !== -1
              ? lines.slice(Math.max(0, nearIdx - 3), nearIdx + 15)
                  .map((l, i) => `${Math.max(1, nearIdx - 2) + i}: ${l}`)
                  .join('\n')
              : lines.slice(0, Math.min(lines.length, 80))
                  .map((l, i) => `${i + 1}: ${l}`)
                  .join('\n')
            return {
              result: `old_string not found in ${path}. Your old_string had a whitespace or content mismatch.\n\nHere is the actual file content — use these exact lines (with exact leading spaces) to build a new old_string:\n\n${section}`,
              isError: true,
            }
          }
          if (occurrences > 1) {
            return {
              result: `old_string appears ${occurrences} times in ${path} — include more surrounding context to make it unique`,
              isError: true,
            }
          }
          const idx = content.indexOf(oldString)
          const updated = content.slice(0, idx) + newString + content.slice(idx + oldString.length)
          await writeFile(path, updated, 'utf-8')
          return { result: `Edited ${path}`, isError: false }
        }
        case 'create_file': {
          const path = args.path as string
          const content = args.content as string
          try {
            await writeFile(path, content, { encoding: 'utf-8', flag: 'wx' })
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
              return { result: `${path} already exists — use edit_file or write_file`, isError: true }
            }
            throw err
          }
          return { result: `Created ${path}`, isError: false }
        }
        case 'glob_search': {
          const root = args.root as string
          const pattern = args.pattern as string
          const IGNORED_SEGMENTS = new Set(['node_modules', '.git', 'dist', 'out'])
          const allFiles = await listAllFiles(root)
          const candidates = allFiles.filter((f) => {
            const rel = relative(root, f)
            return !rel.split(/[\\/]/).some((segment) => IGNORED_SEGMENTS.has(segment))
          })
          const allMatches = candidates.filter((f) => minimatch(relative(root, f), pattern))
          const GLOB_MATCH_CAP = 300
          const matches = allMatches.slice(0, GLOB_MATCH_CAP)
          const truncated = allMatches.length > GLOB_MATCH_CAP
          return {
            result: JSON.stringify({ matches, truncated, totalMatches: allMatches.length }),
            isError: false,
          }
        }
        case 'delete_file': {
          const path = args.path as string
          await unlink(path)
          return { result: `Deleted ${path}`, isError: false }
        }
        case 'move_file': {
          const from = args.from as string
          const to = args.to as string
          const destExists = await access(to).then(() => true).catch(() => false)
          if (destExists) {
            return { result: `${to} already exists — delete it first or choose another destination`, isError: true }
          }
          await rename(from, to)
          return { result: `Moved ${from} to ${to}`, isError: false }
        }
        default:
          return { result: `Unknown tool: ${name}`, isError: true }
      }
    } catch (err) {
      return { result: (err as Error).message, isError: true }
    }
  }

  private async streamOneCompletion(
    win: BrowserWindow,
    messages: CosmosMessage[],
    settings: CosmosSettings
  ): Promise<{ content: string; toolCalls: PendingToolCall[] } | null> {
    const controller = new AbortController()
    this.controllerByWindow.set(win.id, controller)

    let response: Response
    try {
      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      }
      if (settings.sessionId) reqHeaders['X-Cosmos-Session-ID'] = settings.sessionId
      response = await fetch(`${settings.endpoint}/chat/completions`, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ model: settings.modelId, messages, tools: COSMOS_TOOLS, stream: true }),
        signal: controller.signal,
      })
    } catch (err) {
      this.emit(win, { type: 'error', message: `Cosmos request failed: ${(err as Error).message}` })
      return null
    }

    if (!response.ok) {
      this.emit(win, { type: 'error', message: `Cosmos request failed: ${response.status}` })
      return null
    }

    if (!response.body) {
      this.emit(win, { type: 'error', message: 'Cosmos response had no body' })
      return null
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    const toolCallAccs: Record<number, { id: string; name: string; args: string }> = {}

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const chunk = parseSSEChunk(line)
          if (!chunk) continue
          const delta = chunk.choices[0]?.delta
          if (delta?.content) {
            content += delta.content
            this.emit(win, { type: 'text-delta', delta: delta.content })
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const acc = toolCallAccs[tc.index] ?? { id: '', name: '', args: '' }
              if (tc.id) acc.id = tc.id
              if (tc.function?.name) acc.name = tc.function.name
              if (tc.function?.arguments) acc.args += tc.function.arguments
              toolCallAccs[tc.index] = acc
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.emit(win, { type: 'error', message: `Cosmos stream error: ${(err as Error).message}` })
      }
      return null
    }

    const toolCalls: PendingToolCall[] = Object.values(toolCallAccs).map((acc) => {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(acc.args || '{}')
      } catch {
        args = {}
      }
      return { id: acc.id, name: acc.name, args }
    })

    const stripped = content.split('\n').filter(l => !l.trimStart().startsWith('[Calling')).join('\n').trim()
    if (stripped !== content) {
      content = stripped
      this.emit(win, { type: 'content-replace', content })
    }

    if (toolCalls.length === 0 && content) {
      const { toolCalls: textCalls, cleanedContent } = extractTextToolCalls(content)
      if (textCalls.length > 0) {
        this.emit(win, { type: 'content-replace', content: cleanedContent })
        return { content: cleanedContent, toolCalls: textCalls }
      }
    }

    return { content, toolCalls }
  }

  disposeWindow(winId: number): void {
    this.controllerByWindow.get(winId)?.abort()
    this.controllerByWindow.delete(winId)
    this.pendingApprovalsByWindow.delete(winId)
    this.cancelledByWindow.delete(winId)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run electron/__tests__/cosmos.test.ts
```

Expected: PASS (all existing Cosmos tests, unchanged behavior).

- [ ] **Step 5: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.node.json
```

Expected: error in `electron/main.ts` (`new CosmosManager(win)`) — expected, fixed in Task 15.

- [ ] **Step 7: Commit**

```bash
git add electron/cosmos.ts electron/__tests__/cosmos.test.ts
git commit -m "Convert CosmosManager to per-window isolation"
```

---

### Task 14: BrowserViewManager — per-window isolation

**Files:**
- Modify: `electron/browserViews.ts`
- Create: `electron/__tests__/browserViews.test.ts`

**Interfaces:**
- Produces: `BrowserViewManager.registerHandlers(): void` (called once), `BrowserViewManager.disposeWindow(winId: number): void`. Constructor takes no arguments.

- [ ] **Step 1: Write the failing isolation test**

Create `electron/__tests__/browserViews.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { handlers } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
}))

function fakeWebContentsView() {
  return {
    setBackgroundColor: vi.fn(),
    webContents: {
      id: Math.floor(Math.random() * 100000),
      loadURL: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      getZoomLevel: vi.fn(() => 0),
    },
  }
}

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => sender,
  },
  WebContentsView: vi.fn().mockImplementation(() => fakeWebContentsView()),
  session: { fromPartition: vi.fn(() => ({})) },
}))

import { BrowserViewManager } from '../browserViews'

function fakeWin(id: number) {
  return {
    id,
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
  }
}

describe('BrowserViewManager multi-window isolation', () => {
  it('creating a view with the same id in two windows produces two independent entries', () => {
    const manager = new BrowserViewManager()
    manager.registerHandlers()
    const winA = fakeWin(1)
    const winB = fakeWin(2)

    const idA = handlers['browserView:create']({ sender: winA }, 'tab-1', 'https://example.com')
    const idB = handlers['browserView:create']({ sender: winB }, 'tab-1', 'https://example.org')

    expect(winA.contentView.addChildView).toHaveBeenCalledTimes(1)
    expect(winB.contentView.addChildView).toHaveBeenCalledTimes(1)
    expect(idA).not.toBe(idB)
  })

  it('disposeWindow destroys only that window\'s views', () => {
    const manager = new BrowserViewManager()
    manager.registerHandlers()
    const winA = fakeWin(1)
    const winB = fakeWin(2)

    handlers['browserView:create']({ sender: winA }, 'tab-1', 'https://example.com')
    handlers['browserView:create']({ sender: winB }, 'tab-1', 'https://example.org')
    manager.disposeWindow(1)

    expect(winA.contentView.removeChildView).toHaveBeenCalledTimes(1)
    expect(winB.contentView.removeChildView).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run electron/__tests__/browserViews.test.ts
```

Expected: FAIL — `new BrowserViewManager()` doesn't match the current `constructor(private win: BrowserWindow)` signature.

- [ ] **Step 3: Rewrite browserViews.ts**

Replace the full contents of `electron/browserViews.ts`:

```ts
import { BrowserWindow, WebContentsView, ipcMain, session } from 'electron'

// Guest pages share this dedicated partition with each other (so cookies/logins
// persist across browser tabs like normal browser tabs would) but NOT with the
// main window's own session. Without this, WebContentsView shares Electron's
// default session with the main window, and Chromium's zoom level is scoped to
// the session rather than the individual webContents — so zooming a guest page
// silently zoomed the entire app UI (sidebar, tabs, everything) in lockstep.
// Created lazily (not at module load) because session.fromPartition requires
// the app to be ready.
function getBrowserSession(): Electron.Session {
  return session.fromPartition('persist:browser-tabs')
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export type BrowserViewEvent =
  | { type: 'did-start-loading' }
  | { type: 'did-stop-loading'; canGoBack: boolean; canGoForward: boolean }
  | { type: 'did-navigate'; url: string; canGoBack: boolean; canGoForward: boolean }
  | { type: 'did-navigate-in-page'; url: string; canGoBack: boolean; canGoForward: boolean }
  | { type: 'page-title-updated'; title: string }
  | { type: 'did-fail-load'; errorDescription: string }
  | { type: 'dom-ready'; webContentsId: number }
  | { type: 'zoom-changed'; level: number }
  | { type: 'open-in-new-tab'; url: string }

interface Entry {
  view: WebContentsView
  attached: boolean
}

// <webview> was dropped in favor of WebContentsView because Electron's <webview>
// guest never syncs its own window.innerHeight/vh-based layout past the intrinsic
// 300x150 default — confirmed via isolated repro, not fixable from the outside.
// WebContentsView reports its real bounds to the guest correctly, at the cost of
// needing its pixel bounds pushed from the renderer on every resize/pane-move
// instead of it just living in the DOM flex layout.
export class BrowserViewManager {
  private viewsByWindow = new Map<number, Map<string, Entry>>()

  registerHandlers(): void {
    ipcMain.handle('browserView:create', (event, id: string, url: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      return win ? this.create(win, id, url) : null
    })
    ipcMain.handle('browserView:setBounds', (event, id: string, bounds: Bounds) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) this.setBounds(win.id, id, bounds)
    })
    ipcMain.handle('browserView:setVisible', (event, id: string, visible: boolean) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) this.setVisible(win, id, visible)
    })
    ipcMain.handle('browserView:navigate', (event, id: string, url: string) =>
      this.get(this.winIdOf(event), id)?.webContents.loadURL(url)
    )
    ipcMain.handle('browserView:goBack', (event, id: string) =>
      this.get(this.winIdOf(event), id)?.webContents.navigationHistory.goBack()
    )
    ipcMain.handle('browserView:goForward', (event, id: string) =>
      this.get(this.winIdOf(event), id)?.webContents.navigationHistory.goForward()
    )
    ipcMain.handle('browserView:reload', (event, id: string) =>
      this.get(this.winIdOf(event), id)?.webContents.reload()
    )
    ipcMain.handle('browserView:zoomIn', (event, id: string) => {
      const winId = this.winIdOf(event)
      this.setZoom(winId, id, (this.get(winId, id)?.webContents.getZoomLevel() ?? 0) + 1)
    })
    ipcMain.handle('browserView:zoomOut', (event, id: string) => {
      const winId = this.winIdOf(event)
      this.setZoom(winId, id, (this.get(winId, id)?.webContents.getZoomLevel() ?? 0) - 1)
    })
    ipcMain.handle('browserView:zoomReset', (event, id: string) => this.setZoom(this.winIdOf(event), id, 0))
    ipcMain.handle('browserView:destroy', (event, id: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) this.destroy(win, id)
    })
  }

  private winIdOf(event: Electron.IpcMainInvokeEvent): number {
    return BrowserWindow.fromWebContents(event.sender)?.id ?? -1
  }

  private entriesFor(winId: number): Map<string, Entry> {
    let entries = this.viewsByWindow.get(winId)
    if (!entries) {
      entries = new Map()
      this.viewsByWindow.set(winId, entries)
    }
    return entries
  }

  private get(winId: number, id: string): WebContentsView | undefined {
    return this.viewsByWindow.get(winId)?.get(id)?.view
  }

  private create(win: BrowserWindow, id: string, url: string): number | null {
    const entries = this.entriesFor(win.id)
    const existing = entries.get(id)
    if (existing) return existing.view.webContents.id

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        session: getBrowserSession(),
      },
    })
    view.setBackgroundColor('#1e1e1e')
    view.webContents.loadURL(url)
    this.wireEvents(win, id, view)

    win.contentView.addChildView(view)
    entries.set(id, { view, attached: true })
    return view.webContents.id
  }

  private sendEvent(win: BrowserWindow, id: string, payload: BrowserViewEvent): void {
    if (!win.isDestroyed()) win.webContents.send('browserView:event', id, payload)
  }

  private wireEvents(win: BrowserWindow, id: string, view: WebContentsView): void {
    const wc = view.webContents

    // Links/scripts that would normally pop a real OS window (target="_blank",
    // window.open, ctrl/cmd-click) get deny'd here — WebContentsView has no
    // window of its own to pop one into anyway — and handed to the renderer
    // instead, which opens it as a new browser tab in the app's own tab strip.
    wc.setWindowOpenHandler((details) => {
      this.sendEvent(win, id, { type: 'open-in-new-tab', url: details.url })
      return { action: 'deny' }
    })

    wc.on('did-start-loading', () => this.sendEvent(win, id, { type: 'did-start-loading' }))
    wc.on('did-stop-loading', () =>
      this.sendEvent(win, id, {
        type: 'did-stop-loading',
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      })
    )
    wc.on('did-navigate', (_e, url) =>
      this.sendEvent(win, id, {
        type: 'did-navigate',
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      })
    )
    wc.on('did-navigate-in-page', (_e, url) =>
      this.sendEvent(win, id, {
        type: 'did-navigate-in-page',
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      })
    )
    wc.on('page-title-updated', (_e, title) => this.sendEvent(win, id, { type: 'page-title-updated', title }))
    wc.on('did-fail-load', (_e, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
      // -3 is ERR_ABORTED, fired on normal navigation interruption (e.g. redirects) — not a real failure
      if (!isMainFrame || errorCode === -3) return
      this.sendEvent(win, id, { type: 'did-fail-load', errorDescription })
    })
    wc.on('dom-ready', () => {
      this.sendEvent(win, id, { type: 'dom-ready', webContentsId: wc.id })
      this.sendEvent(win, id, { type: 'zoom-changed', level: wc.getZoomLevel() })
      // Trackpad pinch and Ctrl+scroll are delivered to the guest page as a
      // ctrlKey wheel event. Real browsers preventDefault() it to drive their own
      // page zoom, which also happens to be what stops macOS's system-wide
      // Accessibility Zoom from treating the same gesture as a request to
      // magnify the whole screen. The arbitrary content loaded here won't do
      // that itself, so do it on its behalf.
      wc.executeJavaScript(
        `window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault() }, { passive: false, capture: true })`
      ).catch(() => {})
    })

    // Unshifted CmdOrCtrl+=/-/0 zoom just this guest — same "unshifted = scoped to
    // the focused thing" split the editor/terminal use, extended to embedded pages.
    // Shares setZoom() with the browserView:zoomIn/zoomOut/zoomReset IPC handlers
    // (used by the browser tab's own "..." menu) so both paths apply the exact
    // same clamp and always agree on the current level.
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.shift || input.alt) return
      if (!input.meta && !input.control) return

      if (input.key === '=' || input.key === '+') {
        event.preventDefault()
        this.setZoom(win.id, id, wc.getZoomLevel() + 1)
      } else if (input.key === '-' || input.key === '_') {
        event.preventDefault()
        this.setZoom(win.id, id, wc.getZoomLevel() - 1)
      } else if (input.key === '0') {
        event.preventDefault()
        this.setZoom(win.id, id, 0)
      }
    })
  }

  private setZoom(winId: number, id: string, level: number): void {
    const wc = this.get(winId, id)?.webContents
    if (!wc) return
    const clamped = Math.max(-8, Math.min(9, level))
    wc.setZoomLevel(clamped)
    const win = BrowserWindow.fromId(winId)
    if (win) this.sendEvent(win, id, { type: 'zoom-changed', level: clamped })
  }

  private setBounds(winId: number, id: string, bounds: Bounds): void {
    this.get(winId, id)?.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    })
  }

  private setVisible(win: BrowserWindow, id: string, visible: boolean): void {
    const entry = this.viewsByWindow.get(win.id)?.get(id)
    if (!entry) return
    if (visible && !entry.attached) {
      win.contentView.addChildView(entry.view)
      entry.attached = true
    } else if (!visible && entry.attached) {
      win.contentView.removeChildView(entry.view)
      entry.attached = false
    }
  }

  private destroy(win: BrowserWindow, id: string): void {
    const entry = this.viewsByWindow.get(win.id)?.get(id)
    if (!entry) return
    if (entry.attached) win.contentView.removeChildView(entry.view)
    entry.view.webContents.close({ waitForBeforeUnload: false })
    this.viewsByWindow.get(win.id)?.delete(id)
  }

  disposeWindow(winId: number): void {
    const win = BrowserWindow.fromId(winId)
    const entries = this.viewsByWindow.get(winId)
    if (entries && win) {
      for (const [id] of entries) this.destroy(win, id)
    }
    this.viewsByWindow.delete(winId)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run electron/__tests__/browserViews.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.node.json
```

Expected: error in `electron/main.ts` (`new BrowserViewManager(win)`) — expected, fixed in Task 15.

- [ ] **Step 7: Commit**

```bash
git add electron/browserViews.ts electron/__tests__/browserViews.test.ts
git commit -m "Convert BrowserViewManager to per-window isolation"
```

---

### Task 15: main.ts — multi-window lifecycle

**Files:**
- Modify: `electron/main.ts`

**Interfaces:**
- Consumes: the six managers' new no-arg constructors and `disposeWindow(winId)` methods from Tasks 9-14.
- Produces: `createWindow(projectRoot?: string): BrowserWindow` callable more than once; sends `menu:openInitialProject` (consumed by Task 16).

- [ ] **Step 1: Update `createWindow` to accept a project path and set the title**

Replace the `createWindow` function (lines 56-90):

```ts
const windows = new Map<number, BrowserWindow>()

function createWindow(projectRoot?: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: projectRoot ? basename(projectRoot) : 'Huginn',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  windows.set(win.id, win)
  win.once('ready-to-show', () => win.show())
  win.on('focus', () => buildMenu())
  win.on('closed', () => {
    windows.delete(win.id)
    ptyMgr.disposeWindow(win.id)
    claudeMgr.disposeWindow(win.id)
    gitWatcher.disposeWindow(win.id)
    cosmosMgr.disposeWindow(win.id)
    browserViewMgr.disposeWindow(win.id)
    buildMenu()
  })

  // Chromium persists page zoom per-origin across restarts. If it ever gets
  // stuck at some large factor (e.g. a stray native zoom accelerator firing
  // repeatedly), that would otherwise survive indefinitely — force it back to
  // 100% on every load so the window can never get stuck zoomed.
  win.webContents.on('dom-ready', () => {
    win.webContents.setZoomFactor(1)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (projectRoot) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('menu:openInitialProject', projectRoot)
    })
  }

  return win
}
```

`basename` needs importing from `'path'` — add it to the existing `import { join } from 'path'` line (line 2), making it `import { basename, join } from 'path'`.

The six manager instances (`ptyMgr`, `claudeMgr`, `gitWatcher`, `cosmosMgr`, `browserViewMgr` — `gitRunner` has no `disposeWindow`, see Task 12) referenced inside `createWindow`'s `closed` handler must exist before `createWindow` is ever called — Step 2 below moves their construction earlier for exactly this reason.

- [ ] **Step 2: Restructure `app.whenReady()` — construct managers once, register handlers once, create the first window**

Replace the `app.whenReady().then(...)` block (the block Task 1 already added a line to, and lines matching the original 214-239):

```ts
let ptyMgr: PtyManager
let claudeMgr: ClaudeManager
let gitWatcher: GitWatcher
let cosmosMgr: CosmosManager
let browserViewMgr: BrowserViewManager

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.setIcon(join(__dirname, '../../icon.png'))
  }

  registerFsHandlers()
  registerCosmosSettingsHandlers()
  registerDevtoolsHandlers()
  registerSessionHandlers()

  ptyMgr = new PtyManager()
  ptyMgr.registerHandlers()
  claudeMgr = new ClaudeManager()
  claudeMgr.registerHandlers()
  const gitRunner = new GitRunner()
  gitRunner.registerHandlers()
  gitWatcher = new GitWatcher()
  gitWatcher.registerHandlers()
  cosmosMgr = new CosmosManager()
  cosmosMgr.registerHandlers()
  browserViewMgr = new BrowserViewManager()
  browserViewMgr.registerHandlers()

  buildMenu()
  createWindow()

  // MobileServer (deliberately left untouched — an app-wide singleton per the
  // spec, not per-window) pushes 'mobile:state' events to whatever `win` it
  // was constructed with. With multiple real windows there's no single
  // correct target — its state is account-level (pairing PIN, usage stats),
  // not tied to any one project — so give it a fake win-shaped object whose
  // webContents.send() broadcasts to every currently-open window instead.
  const mobileSrv = new MobileServer({
    webContents: {
      send: (...args: unknown[]) => {
        for (const w of windows.values()) {
          if (!w.isDestroyed()) (w.webContents.send as (...a: unknown[]) => void)(...args)
        }
      },
    },
  } as unknown as BrowserWindow)
  mobileSrv.registerHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
```

- [ ] **Step 3: Update the `window-all-closed` handler**

The existing handler (lines 241-243) is unchanged — `if (process.platform !== 'darwin') app.quit()` already does the right thing: quits on Windows/Linux when the last window closes, stays running with zero windows on macOS (where `File > New Window` or the Dock icon can reopen one). No edit needed here — confirm it's still present after the surrounding edits, since nothing in this task should have touched it.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit -p tsconfig.node.json
```

Expected: no errors — this is the task that resolves every "expected error, fixed in Task 15" flagged in Tasks 9-14.

- [ ] **Step 5: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 6: Manual verification**

`npm run dev`. Confirm the app still launches to a single window with the last-used project restored (unchanged single-window behavior). This task doesn't yet expose any way to open a *second* window (that's Task 19) — this step is purely a regression check that the restructuring didn't break the existing single-window flow: terminal opens and runs commands, git status updates, Claude chat spawns, browser tabs load, Mobile Display panel starts/stops correctly.

- [ ] **Step 7: Commit**

```bash
git add electron/main.ts
git commit -m "Restructure main.ts for multi-window: singleton managers, per-window disposal, MobileServer broadcast"
```

---

### Task 16: fileStore.ts — initial-project bootstrap for additional windows

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/types/api.d.ts`
- Modify: `src/stores/fileStore.ts`
- Test: `src/stores/__tests__/fileStore.test.ts` (create if it doesn't already exist; extend if it does)

**Interfaces:**
- Consumes: `menu:openInitialProject` IPC message sent by Task 15's `createWindow`.
- Produces: `useFileStore.getState().openProjectAt(path: string): Promise<void>` (new method, consumed by Task 19's recent-projects wiring — opening a path without going through the native folder-picker dialog).

- [ ] **Step 1: Check for an existing fileStore test file**

```bash
ls src/stores/__tests__/ | grep -i filestore
```

If `fileStore.test.ts` exists, read it first to match its existing mocking conventions for `window.api` before adding new tests; if it doesn't exist, Step 2 creates it fresh.

- [ ] **Step 2: Add the preload bridge for the initial-project message**

In `electron/preload.ts`, add alongside the other `onMenu*` bridges (after the block Task 4 added):

```ts
  onMenuOpenInitialProject: (cb: (projectRoot: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, projectRoot: string) => cb(projectRoot)
    ipcRenderer.on('menu:openInitialProject', handler)
    return () => ipcRenderer.removeListener('menu:openInitialProject', handler)
  },
```

In `src/types/api.d.ts`, add alongside the other `onMenu*` type declarations:

```ts
      onMenuOpenInitialProject: (cb: (projectRoot: string) => void) => () => void
```

- [ ] **Step 3: Write the failing test for `openProjectAt`**

Create (or extend) `src/stores/__tests__/fileStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFileStore } from '../fileStore'

describe('fileStore.openProjectAt', () => {
  beforeEach(() => {
    useFileStore.setState({ projectRoot: null, tree: [], selectedPath: null })
    ;(window as any).api = {
      readDir: vi.fn().mockResolvedValue([{ name: 'file.ts', path: '/repo/file.ts', isDirectory: false }]),
      gitWatchRoot: vi.fn(),
    }
    localStorage.clear()
  })

  it('sets projectRoot and tree from the given path without opening a picker dialog', async () => {
    await useFileStore.getState().openProjectAt('/repo')
    expect(useFileStore.getState().projectRoot).toBe('/repo')
    expect(useFileStore.getState().tree).toEqual([{ name: 'file.ts', path: '/repo/file.ts', isDirectory: false }])
    expect(window.api.gitWatchRoot).toHaveBeenCalledWith('/repo')
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
npx vitest run src/stores/__tests__/fileStore.test.ts
```

Expected: FAIL — `openProjectAt` doesn't exist on the store yet.

- [ ] **Step 5: Add `openProjectAt` to fileStore.ts and gate `restoreRoot` on the initial-project bootstrap**

In `src/stores/fileStore.ts`, add `openProjectAt` to the `FileState` interface (after `openFolder: () => Promise<void>`, line 26):

```ts
  openProjectAt: (root: string) => Promise<void>,
```

Add the implementation (after the `openFolder` implementation, lines 56-69):

```ts
  openProjectAt: async (root: string) => {
    const tree = await window.api.readDir(root)
    set({ projectRoot: root, tree })
    window.api.gitWatchRoot(root)
  },
```

This intentionally does **not** touch `localStorage` — writing to `huginn:lastProjectRoot` is reserved for the *first* window's own project choices (via `openFolder`, unchanged), since that's the shared-origin key every window's `restoreRoot()` would read from; a second window's initial project shouldn't overwrite what the first window will restore to on the next app launch.

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/stores/__tests__/fileStore.test.ts
```

Expected: PASS.

- [ ] **Step 7: Wire the IPC listener in App.tsx, guarding the existing `restoreRoot()` bootstrap**

In `src/App.tsx`, find the existing bootstrap effect:

```ts
  useEffect(() => {
    useFileStore.getState().restoreRoot()
  }, [])
```

Replace it with:

```ts
  useEffect(() => {
    let initialProjectReceived = false
    const unsubscribe = window.api.onMenuOpenInitialProject((projectRoot) => {
      initialProjectReceived = true
      useFileStore.getState().openProjectAt(projectRoot)
    })
    // Give the (synchronous, IPC-ordered-before-any-render) initial-project
    // message a chance to arrive first — main.ts sends it from the window's
    // own 'did-finish-load', which fires before this component's effects run,
    // so by the time this line executes we already know whether one arrived.
    if (!initialProjectReceived) {
      useFileStore.getState().restoreRoot()
    }
    return unsubscribe
  }, [])
```

- [ ] **Step 8: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 9: Type-check**

```bash
npx tsc --noEmit -p tsconfig.web.json
npx tsc --noEmit -p tsconfig.node.json
```

- [ ] **Step 10: Commit**

```bash
git add electron/preload.ts src/types/api.d.ts src/stores/fileStore.ts src/stores/__tests__/fileStore.test.ts src/App.tsx
git commit -m "Add openProjectAt bootstrap path for windows opened with an initial project"
```

---

### Task 17: Recent projects persistence

**Files:**
- Create: `electron/recentProjects.ts`
- Create: `electron/__tests__/recentProjects.test.ts`
- Modify: `electron/main.ts` (register handlers)

**Interfaces:**
- Produces: `registerRecentProjectsHandlers(): void`; IPC channels `recentProjects:list` (returns `{ path: string; lastOpened: number }[]`, newest first, capped at 10), `recentProjects:add` (touches/inserts one path), `recentProjects:clear`.

- [ ] **Step 1: Write the failing test**

Create `electron/__tests__/recentProjects.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { handlers, fsState } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => unknown>,
  fsState: { files: new Map<string, string>() },
}))

vi.mock('electron', () => ({
  app: { getPath: () => '/fake/userData' },
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
  },
}))

vi.mock('fs/promises', () => ({
  readFile: async (path: string) => {
    if (!fsState.files.has(path)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    return fsState.files.get(path)!
  },
  writeFile: async (path: string, data: string) => {
    fsState.files.set(path, data)
  },
  mkdir: async () => {},
}))

import { registerRecentProjectsHandlers } from '../recentProjects'

describe('recentProjects', () => {
  beforeEach(() => {
    fsState.files.clear()
    registerRecentProjectsHandlers()
  })

  it('returns an empty list when nothing has been added yet', async () => {
    const result = await handlers['recentProjects:list']()
    expect(result).toEqual([])
  })

  it('add() inserts a new entry that list() returns', async () => {
    await handlers['recentProjects:add']({}, '/repo/a')
    const result = (await handlers['recentProjects:list']()) as { path: string }[]
    expect(result.map((r) => r.path)).toEqual(['/repo/a'])
  })

  it('re-adding an existing path moves it to the front instead of duplicating it', async () => {
    await handlers['recentProjects:add']({}, '/repo/a')
    await handlers['recentProjects:add']({}, '/repo/b')
    await handlers['recentProjects:add']({}, '/repo/a')
    const result = (await handlers['recentProjects:list']()) as { path: string }[]
    expect(result.map((r) => r.path)).toEqual(['/repo/a', '/repo/b'])
  })

  it('caps the list at 10 entries, dropping the oldest', async () => {
    for (let i = 0; i < 12; i++) {
      await handlers['recentProjects:add']({}, `/repo/${i}`)
    }
    const result = (await handlers['recentProjects:list']()) as { path: string }[]
    expect(result).toHaveLength(10)
    expect(result[0].path).toBe('/repo/11')
    expect(result.map((r) => r.path)).not.toContain('/repo/0')
    expect(result.map((r) => r.path)).not.toContain('/repo/1')
  })

  it('clear() empties the list', async () => {
    await handlers['recentProjects:add']({}, '/repo/a')
    await handlers['recentProjects:clear']()
    const result = await handlers['recentProjects:list']()
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run electron/__tests__/recentProjects.test.ts
```

Expected: FAIL — module `../recentProjects` doesn't exist.

- [ ] **Step 3: Write recentProjects.ts**

Create `electron/recentProjects.ts`:

```ts
import { app, ipcMain } from 'electron'
import { join } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'

export interface RecentProject {
  path: string
  lastOpened: number
}

const MAX_RECENTS = 10

function recentsPath(): string {
  return join(app.getPath('userData'), 'recent-projects.json')
}

async function readRecents(): Promise<RecentProject[]> {
  try {
    const data = await readFile(recentsPath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeRecents(recents: RecentProject[]): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(recentsPath(), JSON.stringify(recents), 'utf-8')
}

export function registerRecentProjectsHandlers(): void {
  ipcMain.handle('recentProjects:list', async () => readRecents())

  ipcMain.handle('recentProjects:add', async (_e, path: string) => {
    const recents = await readRecents()
    const withoutPath = recents.filter((r) => r.path !== path)
    const updated = [{ path, lastOpened: Date.now() }, ...withoutPath].slice(0, MAX_RECENTS)
    await writeRecents(updated)
  })

  ipcMain.handle('recentProjects:clear', async () => {
    await writeRecents([])
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run electron/__tests__/recentProjects.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Register the handlers in main.ts**

In `electron/main.ts`, add the import alongside the other electron/ module imports (near `import { registerSessionHandlers } from './session'`):

```ts
import { registerRecentProjectsHandlers } from './recentProjects'
```

Add `registerRecentProjectsHandlers()` to the `app.whenReady()` block from Task 15, alongside the other `register*Handlers()` calls:

```ts
  registerFsHandlers()
  registerCosmosSettingsHandlers()
  registerDevtoolsHandlers()
  registerSessionHandlers()
  registerRecentProjectsHandlers()
```

- [ ] **Step 6: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit -p tsconfig.node.json
```

- [ ] **Step 8: Commit**

```bash
git add electron/recentProjects.ts electron/__tests__/recentProjects.test.ts electron/main.ts
git commit -m "Add recent-projects persistence"
```

---

## Phase 4 — Menu overhaul, part B

### Task 18: preload.ts — recent-projects bridge

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/types/api.d.ts`

**Interfaces:**
- Consumes: `recentProjects:list`/`recentProjects:add`/`recentProjects:clear` from Task 17.
- Produces: `window.api.recentProjectsList(): Promise<RecentProject[]>`, `window.api.recentProjectsAdd(path: string): Promise<void>`, `window.api.recentProjectsClear(): Promise<void>` — consumed by Task 19 (menu-side, for building the submenu) and by `fileStore.openFolder`'s "touch recents on open" call.

- [ ] **Step 1: Add the bridge methods**

In `electron/preload.ts`, add after the `sessionSave` line (end of the exposed API object, before the closing `})`):

```ts
  recentProjectsList: () => ipcRenderer.invoke('recentProjects:list'),
  recentProjectsAdd: (path: string) => ipcRenderer.invoke('recentProjects:add', path),
  recentProjectsClear: () => ipcRenderer.invoke('recentProjects:clear'),
```

- [ ] **Step 2: Add matching types**

In `src/types/api.d.ts`, add a `RecentProject` type near the top (alongside `MobileState`, `CosmosSettings`, etc.):

```ts
export interface RecentProject {
  path: string
  lastOpened: number
}
```

Add the method signatures inside the `Window['api']` interface, after `sessionSave`:

```ts
      recentProjectsList: () => Promise<RecentProject[]>
      recentProjectsAdd: (path: string) => Promise<void>
      recentProjectsClear: () => Promise<void>
```

- [ ] **Step 3: Call `recentProjectsAdd` from `fileStore.openFolder`**

In `src/stores/fileStore.ts`, in `openFolder`'s implementation, add a call right after the existing `window.api.gitWatchRoot(root)` line:

```ts
    window.api.gitWatchRoot(root)
    window.api.recentProjectsAdd(root)
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit -p tsconfig.web.json
```

- [ ] **Step 5: Run the full test suite**

```bash
npm run test
```

- [ ] **Step 6: Commit**

```bash
git add electron/preload.ts src/types/api.d.ts src/stores/fileStore.ts
git commit -m "Add recent-projects renderer bridge, touch recents on Open Project"
```

---

### Task 19: main.ts — New Window, Recent Projects submenu, dynamic Window menu

**Files:**
- Modify: `electron/main.ts`

**Interfaces:**
- Consumes: `createWindow(projectRoot?)` (Task 15), `recentProjects:list`/`recentProjects:add` handlers (Task 17), `dialog:openFolder` (existing, `electron/main.ts:36-39`).

- [ ] **Step 1: Export direct (non-IPC) functions from recentProjects.ts for main-process use**

The menu is built in the main process itself, not a renderer, so it needs to read/mutate recents directly rather than through `ipcMain`/`ipcRenderer`. In `electron/recentProjects.ts`, export the previously-internal `readRecents`, and add two new exported functions that the existing `recentProjects:add`/`recentProjects:clear` IPC handlers can delegate to instead of duplicating logic:

```ts
export async function readRecents(): Promise<RecentProject[]> {
  try {
    const data = await readFile(recentsPath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

export async function addRecentProject(path: string): Promise<void> {
  const recents = await readRecents()
  const withoutPath = recents.filter((r) => r.path !== path)
  const updated = [{ path, lastOpened: Date.now() }, ...withoutPath].slice(0, MAX_RECENTS)
  await writeRecents(updated)
}

export async function clearRecentProjects(): Promise<void> {
  await writeRecents([])
}

export function registerRecentProjectsHandlers(): void {
  ipcMain.handle('recentProjects:list', async () => readRecents())
  ipcMain.handle('recentProjects:add', async (_e, path: string) => addRecentProject(path))
  ipcMain.handle('recentProjects:clear', async () => clearRecentProjects())
}
```

This replaces the file's existing (non-exported) `readRecents` and the body of `registerRecentProjectsHandlers` from Task 17 — the `MAX_RECENTS` constant, `recentsPath()`, and `writeRecents()` helpers stay exactly as Task 17 left them.

- [ ] **Step 2: Make `buildMenu()` async and read recents at build time**

In `electron/main.ts`, update the import to include the three new functions:

```ts
import { registerRecentProjectsHandlers, readRecents, addRecentProject, clearRecentProjects } from './recentProjects'
```

Change `buildMenu()`'s signature and add the fetch as its first line — every existing call site (`createWindow`'s `win.on('focus', ...)` and `win.on('closed', ...)` from Task 15, plus the initial call in `app.whenReady()`) stays a bare `buildMenu()` call with no `await` needed, since none of them depend on the menu having finished rebuilding before continuing (fire-and-forget — the menu just updates a moment later):

```ts
async function buildMenu(): Promise<void> {
  const recents = await readRecents()
  const template: Electron.MenuItemConstructorOptions[] = [
```

(replacing the previous `function buildMenu(): void { const template: Electron.MenuItemConstructorOptions[] = [` line.)

- [ ] **Step 3: Add New Window and Recent Projects to the File menu**

In the `File` menu's `submenu` array (as left by Task 6), insert after the `Open Project…` item and its trailing separator, before the `Reopen Closed Tab` item:

```ts
          {
            label: 'New Window',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: async () => {
              const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
              if (result.canceled || !result.filePaths[0]) return
              const path = result.filePaths[0]
              await addRecentProject(path)
              createWindow(path)
              buildMenu()
            },
          },
          {
            label: 'Recent Projects',
            submenu: recents.length === 0
              ? [{ label: 'No Recent Projects', enabled: false }]
              : [
                  ...recents.map((r) => ({
                    label: r.path,
                    click: async () => {
                      await addRecentProject(r.path)
                      createWindow(r.path)
                      buildMenu()
                    },
                  })),
                  { type: 'separator' as const },
                  {
                    label: 'Clear Recent Projects',
                    click: async () => {
                      await clearRecentProjects()
                      buildMenu()
                    },
                  },
                ],
          },
```

- [ ] **Step 4: Make the Window menu dynamic**

Replace the `Window` menu's `submenu` array (as left by prior tasks, originally lines 203-209):

```ts
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          ...Array.from(windows.values()).map((w) => ({
            label: w.getTitle(),
            type: 'radio' as const,
            checked: w === BrowserWindow.getFocusedWindow(),
            click: () => w.focus(),
          })),
          { type: 'separator' },
          { role: 'front' },
        ],
```

- [ ] **Step 5: Apply the built menu**

At the end of `buildMenu()`, keep the existing final line unchanged:

```ts
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.node.json
```

- [ ] **Step 7: Manual verification**

`npm run dev`. Use `File > New Window`, pick a different folder — confirm a second window opens showing that project (own file tree, own terminal, own git status), and that typing in one window's terminal doesn't echo into the other's. Open `File > Recent Projects` and confirm both folders you've opened this session are listed; click one and confirm it opens a third window at that path. Check the `Window` menu lists all open windows with a checkmark on the focused one, and clicking an entry brings that window forward. Close one window and confirm the app keeps running (macOS) with the remaining window(s) still functional, and that its terminal/Claude/git-watcher processes for the closed window are gone (e.g. via Activity Monitor, no stray `zsh`/`claude` processes left over from the closed window's cwd).

- [ ] **Step 8: Run the full test suite one more time**

```bash
npm run test
```

- [ ] **Step 9: Commit**

```bash
git add electron/main.ts electron/recentProjects.ts
git commit -m "Add New Window, Recent Projects submenu, and dynamic Window menu"
```

---

## Post-implementation check

- [ ] **Re-read the spec** (`docs/superpowers/specs/2026-08-07-electron-branding-multiwindow-menu-design.md`) top to bottom against the final state of the branch — confirm every numbered item in Part 1/2/3 has a corresponding completed task above, and that the "Testing" section's four bullet points have all been exercised (automated tests per-manager, `npm run test` after each phase, manual `npm run dev` checks, packaging config validated without a full build).
- [ ] Full `npm run test` and both `tsc --noEmit` invocations clean on the final state of the branch.
