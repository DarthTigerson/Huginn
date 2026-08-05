# Embedded browser panel with DevTools sidebar and session restoration

## Goal

Add a Chromium-backed browser tab (back/forward/refresh, URL bar, dev-tools
toggle) that opens the same way terminal tabs do, plus a left-sidebar panel
showing real Chrome DevTools for whichever browser tab is currently focused.
While building the tab system's persistence layer for this, extend it to
restore the whole workspace (open tabs, split layout, browser URLs) when the
app relaunches into the same project.

## Tab identity

`browser://<random-id>`, following the existing `terminal://<id>` convention.
`src/components/Settings/paths.ts` gets `isBrowserTab`, `buildBrowserPath`,
`getBrowserId`, mirroring the terminal helpers already there.

## Browser tab (`src/components/Browser/BrowserTab.tsx`)

> **2026-08-06 update:** originally built on Electron's `<webview>` tag for
> the reasons below. Confirmed via isolated repro (bare Electron app, no
> Huginn code) that `<webview>` never syncs its guest's `window.innerHeight`/
> `vh`-based layout past the intrinsic 300x150 default — outer box resizes
> correctly, but any page content sized via viewport units renders short,
> which is not fixable from the host side. Migrated to `WebContentsView`
> (`electron/browserViews.ts`), which reports real bounds to the guest
> correctly. The tradeoff called out below (pixel bounds recalculated and
> pushed over IPC on every resize) is now paid for real — `BrowserTab.tsx`
> polls `getBoundingClientRect()` via `requestAnimationFrame` and calls
> `browserView:setBounds`. New known caveat: `WebContentsView` composites
> above all DOM content, so any floating UI (context menus, dialogs) that
> should appear over a browser tab will currently render behind it — only
> handled so far for the tab's own inline load-error state.

- Uses Electron's `<webview>` tag (`webviewTag: true` added to the
  `BrowserWindow`'s `webPreferences`) rather than `WebContentsView`. A
  `<webview>` is a real DOM element that participates in the existing
  flexbox/resizable-pane layout directly; `WebContentsView` is composited
  outside the DOM and would need its pixel bounds recalculated and pushed
  over IPC on every resize/split, fighting the layout system that already
  exists. `<webview>` also exposes `goBack()` / `goForward()` / `reload()` /
  `loadURL()` / `getWebContentsId()` directly as element methods, so no new
  IPC surface is needed for basic navigation (unlike the terminal, which
  needs a whole PTY-management layer in the main process).
- A module-level `Map<id, LiveBrowserTab>` keeps the `<webview>` alive across
  remounts/pane moves, the same pattern `TerminalTab.tsx` uses for PTY
  sessions (detach-and-reattach the DOM node instead of recreating it).
- Renders a nav bar (back/forward/refresh, a controlled URL input, a
  dev-tools icon at the far right) above the `<webview>`.
- URL bar: Enter normalizes input — has a scheme or looks like a domain
  (contains a dot, no spaces) → treated as a URL, `https://` prepended if no
  scheme; otherwise routed to a search query
  (`https://www.google.com/search?q=<encoded>`).
- On `did-fail-load`, shows an inline "page couldn't load" state (error
  description + retry button) instead of leaving a blank webview.
- Tab label in `TabBar.tsx`: unlike terminal tabs (always the literal
  string "Terminal"), browser tabs show the live page title, falling back
  to "New Tab" while loading — with multiple browser tabs open, a static
  label would make them indistinguishable in the tab strip.

## `useBrowserStore` (new, `src/stores/browserStore.ts`)

Zustand store keyed by tab id, holding what the `<webview>` doesn't expose
to React state: `{ url, title, isLoading, canGoBack, canGoForward,
webContentsId, loadError }`. Populated from the webview's own DOM events
(`did-navigate`, `did-start-loading`, `did-stop-loading`,
`page-title-updated`, `did-fail-load`). `webContentsId` (from
`webview.getWebContentsId()`, available once `dom-ready` fires) is what lets
the DevTools sidebar and the main process address this specific guest page.

## DevTools sidebar (`src/components/Browser/DevToolsPanel.tsx`)

Real embedded Chrome DevTools, not a custom-built panel. Electron supports
this natively via `contents.setDevToolsWebContents(hostWebContents)`: point
one webContents's DevTools frontend at a *different* webContents you control
the position of, instead of Electron's own built-in docking modes (which
only dock relative to the inspected window, not an arbitrary sidebar div).

- `DevToolsPanel` mounts one dedicated "host" `<webview>` (fresh each time
  the panel is opened — DevTools state like which sub-panel is active isn't
  preserved across close/reopen, which is an acceptable simplification).
- New IPC, added to `electron/main.ts` alongside the existing handler groups:
  - `devtools:attach(targetWebContentsId, hostWebContentsId)` →
    `webContents.fromId(target)?.setDevToolsWebContents(host); webContents.fromId(target)?.openDevTools()`
  - `devtools:detach(targetWebContentsId)` →
    `webContents.fromId(target)?.closeDevTools()`
  - Both no-op silently if `fromId` returns undefined (tab already closed).
- Trigger: a `useEffect` watching "the currently active browser tab's id"
  (derived from `useEditorStore`'s `activeTabPath`/`activePaneId` when that
  tab is a `browser://` tab) — whenever the "Developer Options" panel is the
  open `leftPanel` *and* that id changes, re-run `devtools:attach` against
  the new target. This is what makes switching the focused browser tab swap
  the sidebar's DevTools automatically. If the active tab isn't a browser
  tab while the panel is open, the panel shows a "select a browser tab"
  placeholder instead of stale/blank DevTools.
- No separate activity-bar icon for this panel — the dev-tools icon in each
  browser tab's own nav bar is the toggle for `leftPanel = 'devtools'`.

## Opening a browser tab

New "Browser" icon in the activity bar's bottom group, directly above the
existing Terminal icon — same interaction as `openNewTerminal()` (assigns a
random id, calls `openTab({ path: buildBrowserPath(id), ... })`).

## Session persistence

Scope, per discussion: **structure only** — which tabs were open, in what
panes/layout, which was active, and (browser-tab-specific) each browser
tab's last URL. Not unsaved file edits (file tabs re-read fresh from disk on
restore, same as if the app had simply quit today) and not terminal
scrollback (a fresh shell reopens in the same pane position — the old
process is gone regardless, there's nothing to restore there).

- New `electron/session.ts`, following the existing modular-handler pattern
  (`fsOps.ts`, `gitRunner.ts`): `registerSessionHandlers()` exposing
  `session:load(projectRoot)` and `session:save(projectRoot, data)`. Files
  live at `<userData>/sessions/<hash(projectRoot)>.json` — keyed by project
  so opening a different folder restores *that* folder's tabs, not
  whatever was open last regardless of project (matches how the rest of
  the app scopes state to `projectRoot`).
- Persisted shape: `{ layout, paneTabs, paneTabLists, activeTabPath,
  activePaneId, tabs: [{ path }], browserUrls: Record<browserTabId, url> }`
  — deliberately not the full `Tab` (no `content`/`dirty`), and
  `browserUrls` is a separate small map so `useBrowserStore` doesn't need to
  know anything about persistence.
- `useEditorStore` gets a `restoreSession(data)` action that sets
  layout/paneTabs/paneTabLists/tabs/activeTabPath/activePaneId directly,
  bypassing the normal `openTab` flow (which assumes interactive, one-tab-
  at-a-time opening).
- Restore flow lives in `App.tsx`, triggered when `projectRoot` is set:
  load the session file; for each persisted tab whose path is a real
  filesystem path, `window.api.readFile` it to reconstruct `Tab.content`
  (virtual tabs — terminal/browser/settings — get empty content, nothing to
  read); call `restoreSession(...)`; then seed `useBrowserStore` with the
  persisted `browserUrls` so each restored `BrowserTab` knows what to
  navigate to on mount instead of opening blank.
- Save flow: a subscriber on the relevant `editorStore` fields (and
  `browserStore` URLs), debounced ~800ms, calling `session:save`. Debounced
  because tab/layout changes can fire in quick bursts (dragging a split
  divider, rapid tab switches) and this is disk I/O.
- Failure handling: missing or corrupt session file → fall back to today's
  behavior (empty layout, single pane), never throws/blocks startup.

## Error handling summary

- Failed page load → inline retry state in `BrowserTab`, not a crash or
  blank frame.
- DevTools attach/detach → silently no-op if the target/host webContents is
  already gone (tab closed mid-operation).
- Session load → corrupt/missing file treated as "no session", same as
  first launch.

## Testing

`<webview>` and `webContents` DevTools attachment are real Chromium/Electron
behavior that don't run under jsdom/vitest — consistent with the existing
gap around `TerminalTab.tsx`, which also has no unit tests for its
xterm/PTY wiring. Coverage split:
- Unit-testable: `paths.ts` helpers (`isBrowserTab`/`buildBrowserPath`/
  `getBrowserId`), the URL-vs-search normalization function, and the
  session data's serialize/restore shape (pure functions, no Electron APIs).
- Manual verification in the running app: actual page loading/navigation,
  DevTools embedding and swap-on-tab-switch, and session restore across a
  real app relaunch.
