# Electron branding, multi-window, and menu overhaul

## Problem

Three related asks:

1. The app is still visually "Electron" — default Dock icon, "Electron" in the macOS menu bar (next to the apple logo) during `npm run dev`, and no packaging config at all, even though `app.name = 'Huginn'` is already set in `electron/main.ts:92`. `icon.png` (1254×1254, at repo root) exists but is referenced nowhere.
2. Only one project can be open at a time, in one window. There's no way to work on two repos side by side.
3. The menu bar (`electron/main.ts:113-212`) is mostly Electron boilerplate. Several real, working shortcuts (`⌘B` sidebar toggle, `⌘P` command palette, `⌘F` search, `⌘⇧P` action palette, `⌘T` new terminal, `⌘⇧T` reopen closed tab, `⌘L` toggle Claude chat, `⌘S` save) exist only as raw `window.addEventListener('keydown', …)` handlers in the renderer (`src/App.tsx:185-217`, `src/components/Editor/Editor.tsx:93-104`) — invisible to anyone who doesn't already know they exist, and unusable via Linux/Windows menu-bar-driven key-equivalents.

Repo is about to go open source (v0.1.0), with `.dmg` (mac) and `.deb` (Linux) release artifacts, and needs to build from source too. That shapes the packaging approach: cross-platform config, unsigned for now.

## Out of scope

- Code signing / notarization (needs a paid Apple Developer cert; revisit closer to actual public release).
- Windows packaging (not requested).
- Any change to how tabs/panes work within a single project — only cross-*project* isolation changes.
- CI/release automation (GitHub Actions, changelogs, etc.) — just local build config.

## Part 1 — Branding

### Packaged builds

Add `electron-builder` as a devDependency. Config (in `package.json`'s `"build"` key, simplest for a single-package repo):

- `appId: "com.thomasbonnici.huginn"`
- `productName: "Huginn"`
- `icon: "icon.png"` (electron-builder derives `.icns`/multi-res PNGs from one source image ≥1024px)
- `mac.target: "dmg"`, `linux.target: "deb"`, `linux.category: "Development"`
- `files`: point at `out/**` (electron-vite's build output) + `electron/mobileWeb/**` (static assets `MobileServer` reads from disk at runtime via `app.getAppPath()` — must ship as unpacked resources, not bundled into the JS, or `readFileSync` breaks in the packaged app)
- New `package.json` scripts: `"dist:mac": "electron-vite build && electron-builder --mac"`, `"dist:linux": "electron-vite build && electron-builder --linux"`

No signing identity configured — builds will be unsigned. Not building `.dmg`/`.deb` tonight per your call; config just needs to be correct and ready.

### Dev-mode rebrand

`npm run dev` launches the stock `node_modules/electron` binary, whose `Electron.app` bundle (macOS) has "Electron" baked into its `Info.plist` and default icon — this is independent of anything the app's JS does, so `app.name` alone can't fix it (confirmed empirically: `app.name = 'Huginn'` and the app-menu's first-submenu `label: 'Huginn'` are already both set in current code, and the menu bar still shows "Electron").

Two separate mechanisms, because only one of these has a supported runtime API:

**Dock icon** — Electron exposes `app.dock.setIcon(path)` (macOS only) specifically for this. In `electron/main.ts`'s `whenReady()`, before `createWindow()`:
```ts
if (process.platform === 'darwin') app.dock?.setIcon(join(__dirname, '../../icon.png'))
```
Robust, officially supported, always in sync with `icon.png`, no bundle patching, no build step. This alone fixes the Dock icon in both dev and (redundantly, harmlessly) in packaged builds.

**Menu-bar app name** — no equivalent runtime API exists; the text next to the apple logo comes from the OS-level running application's bundle identity (`CFBundleName`), which Electron doesn't expose a setter for. This is the one piece that genuinely needs bundle patching. Add `scripts/rebrand-electron.mjs`, run as a `postinstall` script:

1. Locate `node_modules/electron/dist/Electron.app/Contents/Info.plist`.
2. Skip (no-op) if `CFBundleName` is already `Huginn` (idempotent — safe to re-run).
3. Edit it: `CFBundleName` → `Huginn`, `CFBundleDisplayName` → `Huginn`.
4. Does **not** touch `CFBundleExecutable`, the binary, or the icon — just the two name fields. Smaller surface area than originally scoped (icon is handled entirely by `app.dock.setIcon` above), so there's no `.icns`/`iconutil` generation step in dev mode at all — that only happens in packaged builds, where `electron-builder` does it automatically from `icon.png`.

Runs on every `npm install` (postinstall re-triggers whenever `node_modules/electron` is reinstalled/updated). Failure mode is purely cosmetic: if the script errors, log a warning and continue — dev mode just falls back to showing "Electron" in the menu bar (Dock icon still correct either way, since that's independent), nothing else breaks.

## Part 2 — Multi-window

### Model

One OS process. `File > New Window` (or a recent-projects entry) opens an additional `BrowserWindow`, each bound to its own project root, each with fully working terminal/git/Claude/Cosmos/browser-tabs — not a read-only second view.

### The core problem

`createWindow()` (`electron/main.ts:56-90`) currently runs once. `PtyManager`, `ClaudeManager`, `GitWatcher`, `GitRunner`, `CosmosManager`, `BrowserViewManager` are each `new`'d once, bound to that single `win` via a constructor field, and their `registerHandlers()` calls `ipcMain.handle(channel, …)` / `ipcMain.on(channel, …)` with fixed global channel names (e.g. `electron/pty.ts:24`, `electron/gitRunner.ts:23`).

Electron's `ipcMain` channels are process-global, not scoped to a window. If a second window naively got its own second set of manager instances calling `registerHandlers()` again:

- Every `ipcMain.handle` re-registration **throws** ("Attempted to register a second handler for 'X'").
- Every `ipcMain.on` re-registration **silently adds a second listener** — every event from *either* window fires *both* listeners, so typing in Window A's terminal would also spawn a duplicate shell in Window B's `PtyManager` instance and echo into Window B.

### The fix

Convert each of the six managers from "one `win` field" to "one instance app-wide, `registerHandlers()` called exactly once, per-window state in a `Map` keyed by the requesting window":

```ts
export class PtyManager {
  private byWindow = new Map<number, { procs: Map<string, pty.IPty>; killedIds: Set<string> }>()

  registerHandlers(): void {
    ipcMain.handle('term:spawn', (event, id, cwd) => {
      const win = BrowserWindow.fromWebContents(event.sender)!
      const state = this.stateFor(win.id)
      // ...existing logic, using `state` instead of `this.procs`/`this.killedIds`,
      // and `win.webContents.send(...)` instead of `this.win.webContents.send(...)`
    })
  }

  private stateFor(winId: number) {
    if (!this.byWindow.has(winId)) this.byWindow.set(winId, { procs: new Map(), killedIds: new Set() })
    return this.byWindow.get(winId)!
  }
  // clean up this.byWindow.delete(winId) on window 'closed'
}
```

`BrowserWindow.fromWebContents(event.sender)` is the standard Electron pattern for "which window sent this" — reliable, no reliance on the renderer to self-report an ID. Applies the same way to `ClaudeManager`, `GitWatcher`, `GitRunner`, `CosmosManager`, `BrowserViewManager`. Each manager also needs a `disposeWindow(winId)` (rather than the current single `dispose()`) called from a new `win.on('closed', …)` handler in `createWindow()`, so closing one window kills only *its* terminals/PTYs/watchers, not everyone's.

`MobileServer` and the Cosmos API-key settings handlers (`registerCosmosSettingsHandlers` in `electron/main.ts:94-111`) are **not** touched — they're legitimately account-level singletons (one phone-pairing server, one API key), correctly shared across every window.

`main.ts`'s `app.whenReady()` block changes from "construct managers, create one window" to "construct the (now singleton) managers and call `registerHandlers()` once, then `createWindow()` can be called any number of times" — each call just needs to reach into the already-registered managers' per-window maps, not construct new manager instances.

### Project-path state

`fileStore.ts`'s `projectRoot` is a per-renderer-process zustand store — safe as-is, since each `BrowserWindow` is its own renderer process with its own JS globals. The actual hazard is `localStorage`: same-origin pages (all windows load the same `file://`/dev-server origin) share the same `localStorage`, so today's single `huginn:lastProjectRoot` key would race between windows on restore.

Fix: only the *first* window at app launch calls `restoreRoot()` (unchanged, reads that key). Every subsequently-created window instead receives its target project path directly — main process sends it via a `menu:openInitialProject` IPC message right after the window's `did-finish-load`, and the renderer's bootstrap effect (`src/App.tsx`, near the existing `useFileStore.getState().restoreRoot()` call) branches: if an initial path arrives via IPC, open that instead of restoring from `localStorage`.

Recent-projects list (~10 entries, path + last-opened timestamp) persisted as its own JSON file under `app.getPath('userData')` (mirrors the existing pattern in `electron/session.ts`) — not `localStorage`, for the same cross-window reason.

### Window identity

`createWindow(projectRoot)` sets the `BrowserWindow` title to the repo's folder name (`path.basename(projectRoot)`) instead of the default "Huginn", updated again if the project changes via "Open Project…" in that window. The `Window` menu (`electron/main.ts:201-209`) is rebuilt dynamically: `buildMenu()` (already the single place the whole template is constructed) is called again — from `win.on('focus', …)`, and from the `'closed'` handler added in Part 2 — appending one item per `BrowserWindow.getAllWindows()` entry (label = that window's title, `checked: true` + `type: 'radio'` on the currently-focused one, `click: () => win.focus()`), then re-applying via `Menu.setApplicationMenu`.

## Part 3 — Menu overhaul

New/changed items only (unlisted items are unchanged):

**Huginn** — add `Preferences… (⌘,)`, sends `menu:openSettings`; `src/App.tsx` listens and calls its existing `setLeftPanel('settings')`.

**File**
- `New File (⌘N)` / `New Folder` — new. The create-flow currently lives as local `useState` inside `src/components/Sidebar/Sidebar.tsx` (`startCreate`), not reachable from outside the component. Add a small `useSidebarUiStore` (path/directory-scoped, one-shot) with a `pendingCreate: 'file' | 'directory' | null` field; the menu sends `menu:newFile`/`menu:newFolder`, a listener sets `pendingCreate`, `Sidebar.tsx` consumes it (root-level create, same as today's right-click-on-empty-space path) and clears it.
- `New Terminal (⌘T)` — sends `menu:newTerminal`; renderer calls existing `openNewTerminal()` (`src/App.tsx:206`).
- `Open Project… (⌘O)` — same behavior as today's "Open New Project…", **rebound** from `⇧⌘O` to `⌘O` (frees `⇧⌘N` for New Window, matches the conventional "Open" key equivalent).
- `New Window (⇧⌘N)` — new. Opens the native folder picker (reuses `dialog:openFolder`), then `createWindow(chosenPath)`. Handled entirely in the main process (menu `click` handler), not routed through any renderer.
- `Recent Projects ▸` — submenu, rebuilt each time the menu opens from the persisted recents list; each entry opens that path in a **new** window (not the current one — this is the "quick access to a known repo without re-browsing" case, distinct from "Open Project…" which replaces the current window's project); trailing "Clear Recent Projects" item.
- `Reopen Closed Tab (⇧⌘T)` — sends `menu:reopenClosedTab`; renderer calls existing `useEditorStore.getState().reopenLastClosed()`.
- `Save (⌘S)` — sends `menu:save`; renderer calls existing `saveActiveTab({ allowCreateMissing: true })`.
- `Close Window (⇧⌘W)` — new, `role: 'close'` (closes the focused `BrowserWindow` only — distinct from existing `Close Tab` / `⌘W`, which closes the active editor tab).

**Edit** — add `Find (⌘F)` / `Find in Files (⇧⌘F)`, sending `menu:find` / `menu:findInFiles`; renderer calls existing `useSearchStore.getState().openSearch(shift)`.

**View** — add `Toggle Sidebar (⌘B)`, `Command Palette… (⌘P)`, `Action Palette… (⇧⌘P)`, `Toggle Claude Chat (⌘L)`, each sending a `menu:X` message consumed by the same store calls the raw keydown handlers already use (`setLeftPanel`, `useSearchStore.getState().openCommandPalette()` / `openActionPalette()`, `useClaudeStore.getState().toggleChatVisible()`).

**Window** — becomes dynamic per Part 2 (list of open windows).

### Handling the promoted shortcuts without double-firing

For every shortcut that moves from "raw keydown listener only" to "menu item + accelerator", **remove** the corresponding branch from the raw `window.addEventListener('keydown', …)` handlers in `src/App.tsx` / `src/components/Editor/Editor.tsx` and drive it solely through the new `menu:X` IPC message. Electron's registered menu accelerators are consumed by the native menu/accelerator layer before the key event reaches the web page, so keeping both would be redundant at best and a double-fire risk at worst (untested territory in this codebase — every existing menu accelerator today has no raw-listener counterpart, and vice versa). Single source of truth per shortcut, still fires correctly when the window has focus, still shows correctly in the menu for discoverability.

## Testing

- Existing `electron/__tests__/*.test.ts` construct managers directly with a mock `BrowserWindow` (e.g. `pty.test.ts` presumably does `new PtyManager(mockWin)`) — these need reworking to match the new "singleton + per-window map" shape, asserting per-window isolation (two mock windows, two independent PTY maps) as new coverage, not just a mechanical port.
- `npm run test` (vitest) after each phase.
- `npm run dev` manual check for: Dock icon/menu bar rebrand, opening a second window against a different repo and confirming its terminal/Claude/git are independent of the first, all new menu items firing their expected action.
- Packaging config is validated by running an actual `electron-builder` build locally (not shipped/committed as an artifact) — confirms the config is valid and the app launches from the built output, without yet setting up signing.

## Rollout

Four phases, each shippable/testable on its own. One dependency to call out: the `New Window` and `Recent Projects` menu items (Part 3) only make sense once `createWindow()` can be called more than once with per-window isolation (Part 2) — so those two specific items move after the multi-window work, while every other menu item is independent and comes earlier:

1. **Branding** — icon/name in dev + packaging config. No architecture changes, low risk.
2. **Menu overhaul, part A** — every new/changed item *except* New Window / Recent Projects / the dynamic Window menu: Preferences, New File/Folder, New Terminal, Open Project rebind, Reopen Closed Tab, Save, Close Window, Find/Find in Files, Toggle Sidebar, Command Palette, Action Palette, Toggle Claude Chat. Touches `main.ts`, `preload.ts`, several renderer stores/components, no concurrency concerns.
3. **Multi-window** — the real architectural change (six manager rewrites + window lifecycle + recents persistence + project-path bootstrap). Highest-risk piece; kept isolated so it's easiest to review/revert independently.
4. **Menu overhaul, part B** — New Window, Recent Projects submenu, dynamic Window menu — now that phase 3 gives them something to call.
