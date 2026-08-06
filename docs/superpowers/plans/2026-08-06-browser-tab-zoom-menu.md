# Browser Tab Overflow Menu (Zoom + Developer Options placeholder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a vertical "⋮" button to the embedded browser tab's toolbar that opens a small menu with a working zoom control (−/100%/+, magnifying glass resets to 100%) and a disabled "Developer Options (Coming Soon)" placeholder row.

**Architecture:** Zoom currently lives entirely inside the main process (`electron/browserViews.ts`), driven only by a keyboard shortcut, with zero state visible to the renderer. This plan extracts that keyboard handler's zoom logic into one shared method, exposes it as three new IPC calls, and reports every zoom change (keyboard *or* menu) back to the renderer through the existing per-tab event pipe, so `browserStore` is always the single source of truth for the displayed percentage regardless of which path changed it.

**Tech Stack:** Electron (`WebContentsView`, `ipcMain`/`ipcRenderer`), React, Zustand, Tailwind, Vitest.

## Global Constraints

- Zoom must only ever touch the guest `WebContents` (`view.webContents`) — never `this.win.webContents` (the host app UI). No task in this plan may add code that changes host-window zoom.
- Zoom level clamp is `[-8, 9]` inclusive — matches the existing keyboard shortcut's clamp exactly; do not change this range.
- The keyboard shortcut's trigger condition (unshifted `Cmd/Ctrl` + `=`/`-`/`0`, scoped to the focused browser tab's guest) must not change — this plan only changes *how* that handler's zoom logic is shared with the new menu buttons, never what triggers it or what it's scoped to.
- Zoom percentage is computed from Electron's zoom level with `Math.round(1.2 ** level * 100)` — this is Chromium's own zoom-level-to-factor formula; do not invent a different stepping scheme.
- The disabled placeholder menu item is labeled exactly `Developer Options (Coming Soon)`, matching the existing `To Do (Coming Soon)` convention already used in the activity bar (`src/App.tsx`).
- Follow existing icon conventions: small inline SVG components (`viewBox="0 0 24 24"`, `stroke="currentColor"` or `fill="currentColor"`), matching `NavArrowIcon`/`ReloadIcon` already in `src/components/Browser/BrowserTab.tsx`.
- Follow the existing context-menu convention already used by `src/components/Sidebar/Sidebar.tsx` and `src/components/Git/GitPanel.tsx`: measure the real rendered menu via `useLayoutEffect` and clamp with `src/components/ui/clampToViewport.ts`, close on outside click / Escape via a plain `useEffect` (not `useLayoutEffect`) so the closing listener can never fire for the same click that opened the menu.

---

### Task 1: Zoom-level-to-percent helper

**Files:**
- Create: `src/components/Browser/zoomLevel.ts`
- Test: `src/components/Browser/__tests__/zoomLevel.test.ts`

**Interfaces:**
- Produces: `zoomLevelToPercent(level: number): number` — used by Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/components/Browser/__tests__/zoomLevel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { zoomLevelToPercent } from '../zoomLevel'

describe('zoomLevelToPercent', () => {
  it('returns 100 for level 0', () => {
    expect(zoomLevelToPercent(0)).toBe(100)
  })

  it('returns 120 for level 1', () => {
    expect(zoomLevelToPercent(1)).toBe(120)
  })

  it('returns 83 for level -1', () => {
    expect(zoomLevelToPercent(-1)).toBe(83)
  })

  it('returns 144 for level 2', () => {
    expect(zoomLevelToPercent(2)).toBe(144)
  })

  it('matches the min/max clamp levels used by the keyboard shortcut and menu (-8..9)', () => {
    expect(zoomLevelToPercent(9)).toBe(516)
    expect(zoomLevelToPercent(-8)).toBe(23)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Browser/__tests__/zoomLevel.test.ts`
Expected: FAIL — `Cannot find module '../zoomLevel'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/components/Browser/zoomLevel.ts`:

```ts
// Electron's zoom level → factor formula (matches Chromium's own PageZoom):
// each whole level is a 20% step, compounding — level 0 is 100%, level 1 is
// 120%, level -1 is ~83%, etc.
export function zoomLevelToPercent(level: number): number {
  return Math.round(1.2 ** level * 100)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Browser/__tests__/zoomLevel.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/Browser/zoomLevel.ts src/components/Browser/__tests__/zoomLevel.test.ts
git commit -m "$(cat <<'EOF'
Add zoomLevelToPercent helper for the browser tab zoom menu

Pulled out as its own pure function ahead of the UI/IPC work so the
level-to-percent math (Chromium's own 1.2^level formula) has a real,
DOM-free test.
EOF
)"
```

---

### Task 2: Browser-view zoom IPC (main process + preload + types)

**Files:**
- Modify: `electron/browserViews.ts` (full replacement — most of `wireEvents` changes)
- Modify: `electron/preload.ts`
- Modify: `src/types/api.d.ts`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces (for Task 4 and Task 5):
  - `window.api.browserViewZoomIn(id: string): Promise<void>`
  - `window.api.browserViewZoomOut(id: string): Promise<void>`
  - `window.api.browserViewZoomReset(id: string): Promise<void>`
  - `BrowserViewEvent` union gains `{ type: 'zoom-changed'; level: number }`, delivered through the existing `window.api.onBrowserViewEvent` callback.

There is no automated test for this task — `WebContentsView`/`ipcMain` behavior needs a real Electron window and isn't exercised by any existing test in this repo (`electron/__tests__/` has no test for `browserViews.ts` or `pty.ts`, both of which need a live `BrowserWindow`). This matches the design spec's own testing section. Verification is `tsc --noEmit` here; the real functional check is Task 5's live Electron run.

- [ ] **Step 1: Replace `electron/browserViews.ts` in full**

The `send` closure inside `wireEvents` is promoted to a class method (`sendEvent`) so the new IPC handlers can reuse it, and a new `setZoom` method is shared by both the existing keyboard handler and the new zoom IPC handlers so they can never apply a different clamp or disagree about the current level.

```ts
import { BrowserWindow, WebContentsView, ipcMain } from 'electron'

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
  private views = new Map<string, Entry>()

  constructor(private win: BrowserWindow) {}

  registerHandlers(): void {
    ipcMain.handle('browserView:create', (_e, id: string, url: string) => this.create(id, url))
    ipcMain.handle('browserView:setBounds', (_e, id: string, bounds: Bounds) => this.setBounds(id, bounds))
    ipcMain.handle('browserView:setVisible', (_e, id: string, visible: boolean) => this.setVisible(id, visible))
    ipcMain.handle('browserView:navigate', (_e, id: string, url: string) => this.get(id)?.webContents.loadURL(url))
    ipcMain.handle('browserView:goBack', (_e, id: string) => this.get(id)?.webContents.navigationHistory.goBack())
    ipcMain.handle('browserView:goForward', (_e, id: string) => this.get(id)?.webContents.navigationHistory.goForward())
    ipcMain.handle('browserView:reload', (_e, id: string) => this.get(id)?.webContents.reload())
    ipcMain.handle('browserView:zoomIn', (_e, id: string) =>
      this.setZoom(id, (this.get(id)?.webContents.getZoomLevel() ?? 0) + 1)
    )
    ipcMain.handle('browserView:zoomOut', (_e, id: string) =>
      this.setZoom(id, (this.get(id)?.webContents.getZoomLevel() ?? 0) - 1)
    )
    ipcMain.handle('browserView:zoomReset', (_e, id: string) => this.setZoom(id, 0))
    ipcMain.handle('browserView:destroy', (_e, id: string) => this.destroy(id))
  }

  private get(id: string): WebContentsView | undefined {
    return this.views.get(id)?.view
  }

  private create(id: string, url: string): number | null {
    const existing = this.views.get(id)
    if (existing) return existing.view.webContents.id

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    view.setBackgroundColor('#1e1e1e')
    view.webContents.loadURL(url)
    this.wireEvents(id, view)

    this.win.contentView.addChildView(view)
    this.views.set(id, { view, attached: true })
    return view.webContents.id
  }

  private sendEvent(id: string, payload: BrowserViewEvent): void {
    if (!this.win.isDestroyed()) this.win.webContents.send('browserView:event', id, payload)
  }

  private wireEvents(id: string, view: WebContentsView): void {
    const wc = view.webContents

    wc.on('did-start-loading', () => this.sendEvent(id, { type: 'did-start-loading' }))
    wc.on('did-stop-loading', () =>
      this.sendEvent(id, {
        type: 'did-stop-loading',
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      })
    )
    wc.on('did-navigate', (_e, url) =>
      this.sendEvent(id, {
        type: 'did-navigate',
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      })
    )
    wc.on('did-navigate-in-page', (_e, url) =>
      this.sendEvent(id, {
        type: 'did-navigate-in-page',
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      })
    )
    wc.on('page-title-updated', (_e, title) => this.sendEvent(id, { type: 'page-title-updated', title }))
    wc.on('did-fail-load', (_e, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
      // -3 is ERR_ABORTED, fired on normal navigation interruption (e.g. redirects) — not a real failure
      if (!isMainFrame || errorCode === -3) return
      this.sendEvent(id, { type: 'did-fail-load', errorDescription })
    })
    wc.on('dom-ready', () => {
      this.sendEvent(id, { type: 'dom-ready', webContentsId: wc.id })
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
        this.setZoom(id, wc.getZoomLevel() + 1)
      } else if (input.key === '-' || input.key === '_') {
        event.preventDefault()
        this.setZoom(id, wc.getZoomLevel() - 1)
      } else if (input.key === '0') {
        event.preventDefault()
        this.setZoom(id, 0)
      }
    })
  }

  private setZoom(id: string, level: number): void {
    const wc = this.get(id)?.webContents
    if (!wc) return
    const clamped = Math.max(-8, Math.min(9, level))
    wc.setZoomLevel(clamped)
    this.sendEvent(id, { type: 'zoom-changed', level: clamped })
  }

  private setBounds(id: string, bounds: Bounds): void {
    this.get(id)?.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    })
  }

  private setVisible(id: string, visible: boolean): void {
    const entry = this.views.get(id)
    if (!entry) return
    if (visible && !entry.attached) {
      this.win.contentView.addChildView(entry.view)
      entry.attached = true
    } else if (!visible && entry.attached) {
      this.win.contentView.removeChildView(entry.view)
      entry.attached = false
    }
  }

  private destroy(id: string): void {
    const entry = this.views.get(id)
    if (!entry) return
    if (entry.attached) this.win.contentView.removeChildView(entry.view)
    entry.view.webContents.close({ waitForBeforeUnload: false })
    this.views.delete(id)
  }
}
```

- [ ] **Step 2: Add the three preload wrappers**

In `electron/preload.ts`, find this existing block:

```ts
  browserViewReload: (id: string) => ipcRenderer.invoke('browserView:reload', id),
  browserViewDestroy: (id: string) => ipcRenderer.invoke('browserView:destroy', id),
```

Replace it with:

```ts
  browserViewReload: (id: string) => ipcRenderer.invoke('browserView:reload', id),
  browserViewZoomIn: (id: string) => ipcRenderer.invoke('browserView:zoomIn', id),
  browserViewZoomOut: (id: string) => ipcRenderer.invoke('browserView:zoomOut', id),
  browserViewZoomReset: (id: string) => ipcRenderer.invoke('browserView:zoomReset', id),
  browserViewDestroy: (id: string) => ipcRenderer.invoke('browserView:destroy', id),
```

- [ ] **Step 3: Add the three type signatures**

In `src/types/api.d.ts`, find this existing block:

```ts
      browserViewReload: (id: string) => Promise<void>
      browserViewDestroy: (id: string) => Promise<void>
```

Replace it with:

```ts
      browserViewReload: (id: string) => Promise<void>
      browserViewZoomIn: (id: string) => Promise<void>
      browserViewZoomOut: (id: string) => Promise<void>
      browserViewZoomReset: (id: string) => Promise<void>
      browserViewDestroy: (id: string) => Promise<void>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: all three bundles (`main`, `preload`, `renderer`) build successfully

- [ ] **Step 6: Commit**

```bash
git add electron/browserViews.ts electron/preload.ts src/types/api.d.ts
git commit -m "$(cat <<'EOF'
Expose browser-tab zoom over IPC (zoomIn/zoomOut/zoomReset)

Zoom used to live entirely inside the main process, driven only by the
Cmd+/- keyboard shortcut, with no state visible to the renderer. Extracts
the shared clamp/set/notify logic into one setZoom() method used by both
the existing keyboard handler and three new browserView:zoom* IPC calls,
plus a zoom-changed event, so a future UI control can never drift out of
sync with the keyboard shortcut.
EOF
)"
```

---

### Task 3: `browserStore` zoom level field

**Files:**
- Modify: `src/stores/browserStore.ts`
- Test: `src/stores/__tests__/browserStore.test.ts` (new file)

**Interfaces:**
- Consumes: nothing new.
- Produces: `BrowserTabState.zoomLevel: number` (default `0`), settable via the existing `updateTab(id, patch)` — used by Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/stores/__tests__/browserStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useBrowserStore } from '../browserStore'

describe('browserStore', () => {
  beforeEach(() => {
    useBrowserStore.setState({ tabs: {} })
  })

  it('ensureTab defaults zoomLevel to 0', () => {
    useBrowserStore.getState().ensureTab('tab-1', 'https://example.com')
    expect(useBrowserStore.getState().tabs['tab-1'].zoomLevel).toBe(0)
  })

  it('updateTab can set zoomLevel without disturbing other fields', () => {
    useBrowserStore.getState().ensureTab('tab-1', 'https://example.com')
    useBrowserStore.getState().updateTab('tab-1', { zoomLevel: 3 })
    const tab = useBrowserStore.getState().tabs['tab-1']
    expect(tab.zoomLevel).toBe(3)
    expect(tab.url).toBe('https://example.com')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/__tests__/browserStore.test.ts`
Expected: FAIL — `tabs['tab-1'].zoomLevel` is `undefined`, not `0` (property doesn't exist on `BrowserTabState` yet).

- [ ] **Step 3: Add the field**

In `src/stores/browserStore.ts`, find:

```ts
export interface BrowserTabState {
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  webContentsId: number | null
  loadError: string | null
}
```

Replace with:

```ts
export interface BrowserTabState {
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  webContentsId: number | null
  loadError: string | null
  zoomLevel: number
}
```

Then find:

```ts
const DEFAULT_STATE: BrowserTabState = {
  url: '',
  title: '',
  isLoading: false,
  canGoBack: false,
  canGoForward: false,
  webContentsId: null,
  loadError: null,
}
```

Replace with:

```ts
const DEFAULT_STATE: BrowserTabState = {
  url: '',
  title: '',
  isLoading: false,
  canGoBack: false,
  canGoForward: false,
  webContentsId: null,
  loadError: null,
  zoomLevel: 0,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stores/__tests__/browserStore.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/stores/browserStore.ts src/stores/__tests__/browserStore.test.ts
git commit -m "$(cat <<'EOF'
Track per-tab zoom level in browserStore

Renderer-side home for the zoom-changed event Task 2 introduced — the
overflow menu (Task 4) reads this to display the current percentage.
EOF
)"
```

---

### Task 4: Browser tab overflow menu UI

**Files:**
- Modify: `src/components/Browser/BrowserTab.tsx` (full replacement)

**Interfaces:**
- Consumes:
  - `zoomLevelToPercent(level: number): number` from Task 1 (`./zoomLevel`)
  - `window.api.browserViewZoomIn/ZoomOut/ZoomReset(id: string): Promise<void>` and the `'zoom-changed'` member of `BrowserViewEvent` from Task 2
  - `BrowserTabState.zoomLevel: number` from Task 3
  - `clampToViewport(x, y, width, height, margin?): { x: number; y: number }` from `src/components/ui/clampToViewport.ts` (already exists)
- Produces: nothing new consumed elsewhere — this is the leaf UI.

No automated test — this is interactive menu positioning/behavior on a live `WebContentsView`, the same category of thing the existing Sidebar/Git-panel context menus have no dedicated tests for either. Verified by `tsc --noEmit` here; functional verification is Task 5.

- [ ] **Step 1: Replace `src/components/Browser/BrowserTab.tsx` in full**

```tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBrowserStore } from '@/stores/browserStore'
import { useBrowserSettingsStore } from '@/stores/browserSettingsStore'
import { useEditorStore } from '@/stores/editorStore'
import { buildBrowserPath } from '@/components/Settings/paths'
import { normalizeUrlInput } from './urlBar'
import { clampToViewport } from '@/components/ui/clampToViewport'
import { zoomLevelToPercent } from './zoomLevel'

interface Props {
  browserId: string
}

// Module-level set tracks which browser ids already have a live WebContentsView
// in the main process, so remounts (pane moves, tab switches) reattach/show
// instead of recreating and losing navigation/session state — same pattern
// TerminalTab.tsx uses for PTYs, adapted for a main-process-owned view instead
// of a DOM node.
const liveBrowserViews = new Set<string>()

function boundsEqual(a: DOMRect, b: DOMRect | null): boolean {
  return !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

export function BrowserTab({ browserId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editingRef = useRef(false)
  const tabState = useBrowserStore((s) => s.tabs[browserId])
  const [urlDraft, setUrlDraft] = useState(tabState?.url || useBrowserSettingsStore.getState().defaultUrl)
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    useBrowserStore.getState().ensureTab(browserId, useBrowserSettingsStore.getState().defaultUrl)

    let cancelled = false
    const isNew = !liveBrowserViews.has(browserId)
    liveBrowserViews.add(browserId)

    if (isNew) {
      const initialUrl =
        useBrowserStore.getState().tabs[browserId]?.url || useBrowserSettingsStore.getState().defaultUrl
      window.api.browserViewCreate(browserId, initialUrl).then((webContentsId) => {
        if (cancelled || webContentsId == null) return
        useBrowserStore.getState().updateTab(browserId, { webContentsId })
      })
    } else {
      window.api.browserViewSetVisible(browserId, true)
    }

    const cleanupEvent = window.api.onBrowserViewEvent((id, event) => {
      if (id !== browserId) return
      switch (event.type) {
        case 'did-start-loading':
          useBrowserStore.getState().updateTab(browserId, { isLoading: true, loadError: null })
          break
        case 'did-stop-loading':
          useBrowserStore.getState().updateTab(browserId, {
            isLoading: false,
            canGoBack: event.canGoBack,
            canGoForward: event.canGoForward,
          })
          break
        case 'did-navigate':
        case 'did-navigate-in-page':
          useBrowserStore.getState().updateTab(browserId, {
            url: event.url,
            canGoBack: event.canGoBack,
            canGoForward: event.canGoForward,
          })
          if (!editingRef.current) setUrlDraft(event.url)
          break
        case 'page-title-updated':
          useBrowserStore.getState().updateTab(browserId, { title: event.title })
          break
        case 'did-fail-load':
          useBrowserStore.getState().updateTab(browserId, {
            isLoading: false,
            loadError: event.errorDescription || 'This page could not be loaded.',
          })
          break
        case 'dom-ready':
          useBrowserStore.getState().updateTab(browserId, { webContentsId: event.webContentsId })
          break
        case 'zoom-changed':
          useBrowserStore.getState().updateTab(browserId, { zoomLevel: event.level })
          break
      }
    })

    // WebContentsView is a native layer composited above the window's DOM
    // content, not a DOM node itself — its bounds have to be measured and
    // pushed over IPC instead of just living in the flex layout. Polling via
    // rAF (rather than a ResizeObserver on this element) catches reflows that
    // only move the pane — sidebar toggle, split-divider drag — without
    // changing this element's own size, which a ResizeObserver would miss.
    let lastRect: DOMRect | null = null
    let rafId: number
    const syncBounds = () => {
      const rect = container.getBoundingClientRect()
      if (!boundsEqual(rect, lastRect)) {
        lastRect = rect
        if (rect.width > 0 && rect.height > 0) {
          window.api.browserViewSetBounds(browserId, {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          })
        }
      }
      rafId = requestAnimationFrame(syncBounds)
    }
    rafId = requestAnimationFrame(syncBounds)

    return () => {
      cancelled = true
      cleanupEvent()
      cancelAnimationFrame(rafId)

      const tabPath = buildBrowserPath(browserId)
      const stillOpen = useEditorStore.getState().tabs.some((t) => t.path === tabPath)
      if (!stillOpen) {
        liveBrowserViews.delete(browserId)
        useBrowserStore.getState().removeTab(browserId)
        window.api.browserViewDestroy(browserId)
      } else {
        // Leave the guest alive in the main process, just detached from view,
        // so the next mount (e.g. pane move) can show it with session intact.
        window.api.browserViewSetVisible(browserId, false)
      }
    }
  }, [browserId])

  const loadError = tabState?.loadError ?? null

  // The native view always draws on top of this component's own DOM (including
  // the inline "page couldn't load" state below), so it has to be explicitly
  // hidden while that error overlay is what should be visible.
  useEffect(() => {
    window.api.browserViewSetVisible(browserId, !loadError)
  }, [browserId, loadError])

  useEffect(() => {
    if (!menuAnchor) return
    const close = () => setMenuAnchor(null)
    const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAnchor(null) }
    window.addEventListener('click', close)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuAnchor])

  // Measure the actual rendered menu and clamp it to the real viewport —
  // same approach used for the file-tree and Git-panel context menus — rather
  // than guessing its size from the anchor point alone.
  useLayoutEffect(() => {
    if (!menuAnchor || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const clamped = clampToViewport(menuAnchor.x, menuAnchor.y, rect.width, rect.height)
    menuRef.current.style.left = `${clamped.x}px`
    menuRef.current.style.top = `${clamped.y}px`
  }, [menuAnchor])

  function toggleMenu(e: React.MouseEvent<HTMLButtonElement>) {
    if (menuAnchor) {
      setMenuAnchor(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuAnchor({ x: rect.left, y: rect.bottom + 4 })
  }

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault()
    const url = normalizeUrlInput(urlDraft)
    if (!url) return
    window.api.browserViewNavigate(browserId, url)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  const defaultUrl = useBrowserSettingsStore((s) => s.defaultUrl)
  const url = tabState?.url ?? defaultUrl
  const isLoading = tabState?.isLoading ?? false
  const canGoBack = tabState?.canGoBack ?? false
  const canGoForward = tabState?.canGoForward ?? false
  const zoomPercent = zoomLevelToPercent(tabState?.zoomLevel ?? 0)

  useEffect(() => {
    if (!editingRef.current) setUrlDraft(url)
  }, [url])

  return (
    <div className="h-full w-full flex flex-col bg-bg overflow-hidden">
      <div className="flex items-center gap-1 px-2 h-9 border-b border-border shrink-0 bg-tab-bar">
        <button
          type="button"
          aria-label="Back"
          disabled={!canGoBack}
          onClick={() => window.api.browserViewGoBack(browserId)}
          className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-muted"
        >
          <NavArrowIcon direction="back" />
        </button>
        <button
          type="button"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={() => window.api.browserViewGoForward(browserId)}
          className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-muted"
        >
          <NavArrowIcon direction="forward" />
        </button>
        <button
          type="button"
          aria-label="Reload"
          onClick={() => window.api.browserViewReload(browserId)}
          className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5"
        >
          <ReloadIcon spinning={isLoading} />
        </button>
        <form onSubmit={handleUrlSubmit} className="flex-1 min-w-0">
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onFocus={() => { editingRef.current = true }}
            onBlur={() => { editingRef.current = false; setUrlDraft(url) }}
            spellCheck={false}
            placeholder="Search or enter address"
            className="w-full h-6 rounded bg-bg border border-border px-2 text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent/60"
          />
        </form>
        <button
          type="button"
          aria-label="More options"
          aria-expanded={!!menuAnchor}
          onClick={toggleMenu}
          className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5"
        >
          <MoreVerticalIcon />
        </button>
      </div>

      {menuAnchor && (
        <div
          ref={menuRef}
          className="fixed z-[200] w-56 rounded border border-border bg-popover p-1 shadow-2xl shadow-black/50"
          style={{ left: menuAnchor.x, top: menuAnchor.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1 px-1 py-1">
            <button
              type="button"
              aria-label="Reset zoom"
              onClick={() => window.api.browserViewZoomReset(browserId)}
              className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5"
            >
              <MagnifyingGlassIcon />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => window.api.browserViewZoomOut(browserId)}
              className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5"
            >
              −
            </button>
            <span className="flex-1 text-center text-xs text-fg tabular-nums">{zoomPercent}%</span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => window.api.browserViewZoomIn(browserId)}
              className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5"
            >
              +
            </button>
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            disabled
            className="w-full rounded px-2 py-1.5 text-left text-xs text-fg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Developer Options (Coming Soon)
          </button>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="h-full w-full" />
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg px-4 text-center">
            <p className="text-sm text-fg-muted">This page couldn't load</p>
            <p className="max-w-sm text-xs text-fg-subtle">{loadError}</p>
            <button
              type="button"
              onClick={() => window.api.browserViewReload(browserId)}
              className="mt-1 rounded border border-border px-2 py-1 text-xs text-fg-muted hover:text-fg hover:bg-white/5"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function NavArrowIcon({ direction }: { direction: 'back' | 'forward' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {direction === 'back' ? (
        <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      ) : (
        <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </svg>
  )
}

function ReloadIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 4v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function MoreVerticalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
    </svg>
  )
}

function MagnifyingGlassIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: all three bundles build successfully

- [ ] **Step 4: Commit**

```bash
git add src/components/Browser/BrowserTab.tsx
git commit -m "$(cat <<'EOF'
Add "..." overflow menu to the browser tab (zoom + Developer Options)

Vertical triple-dot button at the right end of the toolbar opens a small
menu: a zoom row (magnifying glass resets to 100%, −/+ step the level)
backed by the zoomIn/zoomOut/zoomReset IPC added in the previous commit,
and a disabled "Developer Options (Coming Soon)" placeholder for the
DevTools sidebar planned in the browser-panel design doc. Menu positioning
reuses the same measure-then-clamp approach as the Sidebar/Git-panel
context menus.
EOF
)"
```

---

### Task 5: End-to-end verification

**Files:**
- None (temporary, uncommitted verification script only — no Playwright dependency is added to the project)

**Interfaces:**
- Consumes: the fully assembled feature from Tasks 1–4.
- Produces: nothing — this is the acceptance check for the whole plan.

This project has no Playwright dependency and none should be added permanently — install it into a throwaway directory outside the repo, exactly like the verification done during the original `<webview>` → `WebContentsView` migration and the ToDo-list UI fixes earlier this session.

- [ ] **Step 1: Build the app**

Run: `npm run build`
Expected: succeeds (same as Task 4 Step 3 — re-run here in case other tasks' changes came after)

- [ ] **Step 2: Set up a scratch Playwright harness**

```bash
SCRATCH=$(mktemp -d)
mkdir -p "$SCRATCH/pwtest"
cd "$SCRATCH/pwtest"
npm init -y >/dev/null 2>&1
npm install playwright@1 >/dev/null 2>&1
cd - >/dev/null
echo "$SCRATCH"
```

Keep the printed `$SCRATCH` path — it's referenced in the next step.

- [ ] **Step 3: Write the verification script**

Create `$SCRATCH/pwtest/verify.js`:

```js
const { _electron: electron } = require('playwright')
const path = require('path')
const os = require('os')

const APP_DIR = '/Users/thomas/Documents/huginn'
const userDataDir = path.join(os.tmpdir(), 'huginn-pw-profile-' + Date.now())

function assert(condition, message) {
  if (!condition) throw new Error('ASSERTION FAILED: ' + message)
  console.log('OK:', message)
}

;(async () => {
  const app = await electron.launch({
    executablePath: path.join(APP_DIR, 'node_modules/.bin/electron'),
    args: [path.join(APP_DIR, 'out/main/index.js'), '--user-data-dir=' + userDataDir],
    cwd: APP_DIR,
  })

  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  await win.evaluate((dir) => localStorage.setItem('huginn:lastProjectRoot', dir), APP_DIR)
  await win.reload()
  await win.waitForTimeout(1500)

  await win.getByLabel('New Browser Tab').click()
  await win.waitForTimeout(1500)

  // Open the "..." menu and check its initial contents.
  await win.getByLabel('More options').click()
  await win.waitForTimeout(300)

  const initialPercent = await win.textContent('text=/^100%$/')
  assert(initialPercent === '100%', 'menu opens showing 100% zoom initially')

  const devOptionsButton = win.getByRole('button', { name: 'Developer Options (Coming Soon)' })
  assert(await devOptionsButton.isDisabled(), '"Developer Options (Coming Soon)" is disabled')

  // Click "+" three times: level 0 -> 3, which is 1.2^3 * 100 = 172.8 -> 173%.
  for (let i = 0; i < 3; i++) {
    await win.getByLabel('Zoom in').click()
    await win.waitForTimeout(150)
  }
  const afterZoomIn = await win.textContent('.fixed.z-\\[200\\] span')
  assert(afterZoomIn === '173%', `zoom-in x3 shows 173%, got ${afterZoomIn}`)

  // Magnifying glass resets to 100%.
  await win.getByLabel('Reset zoom').click()
  await win.waitForTimeout(150)
  const afterReset = await win.textContent('.fixed.z-\\[200\\] span')
  assert(afterReset === '100%', `reset shows 100%, got ${afterReset}`)

  // "-" steps down: level 0 -> -1, which is 1.2^-1 * 100 = 83.33 -> 83%.
  await win.getByLabel('Zoom out').click()
  await win.waitForTimeout(150)
  const afterZoomOut = await win.textContent('.fixed.z-\\[200\\] span')
  assert(afterZoomOut === '83%', `zoom-out shows 83%, got ${afterZoomOut}`)

  // Escape closes the menu.
  await win.keyboard.press('Escape')
  await win.waitForTimeout(150)
  const menuAfterEscape = await win.locator('.fixed.z-\\[200\\]').count()
  assert(menuAfterEscape === 0, 'Escape closes the menu')

  // Keyboard shortcut (Cmd+=) must land on the SAME zoomLevel the menu reads —
  // this is the "single source of truth" guarantee from the design doc.
  // The guest webview isn't a Playwright-automatable page, so simulate the
  // exact native input event the real keyboard shortcut would produce,
  // directly against its WebContents (this exercises the real
  // before-input-event handler in browserViews.ts, not a shortcut around it).
  await app.evaluate(async ({ webContents }) => {
    const guest = webContents.getAllWebContents().find((wc) => wc.getURL() !== '' && wc.id !== 1)
    guest.sendInputEvent({ type: 'keyDown', keyCode: '=', modifiers: ['meta'] })
  })
  await win.waitForTimeout(300)

  await win.getByLabel('More options').click()
  await win.waitForTimeout(300)
  // Keyboard shortcut moved level from -1 (post zoom-out above) to 0 -> 100%.
  const afterKeyboardZoom = await win.textContent('.fixed.z-\\[200\\] span')
  assert(afterKeyboardZoom === '100%', `keyboard Cmd+= after prior -1 level shows 100%, got ${afterKeyboardZoom}`)

  console.log('ALL CHECKS PASSED')
  await app.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 4: Run it**

```bash
cd "$SCRATCH/pwtest" && node verify.js
```

Expected output: seven `OK:` lines followed by `ALL CHECKS PASSED`, no `ASSERTION FAILED` and no thrown error.

- [ ] **Step 5: Clean up the scratch harness**

```bash
rm -rf "$SCRATCH"
```

- [ ] **Step 6: Run the full project test suite and typecheck one more time**

```bash
npx tsc --noEmit -p .
npm test
```

Expected: typecheck clean; test suite passes with the same pre-existing, unrelated failure as before this plan started (`electron/__tests__/cosmos.test.ts` — confirmed present even with none of this plan's changes applied) and no new failures.

This task has no commit — it's verification only, nothing in the repo changes.
