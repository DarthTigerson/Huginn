# Browser tab overflow menu (zoom + placeholder Developer Options)

## Goal

Add a vertical triple-dot ("⋮") button to the right end of the embedded
browser tab's toolbar (`src/components/Browser/BrowserTab.tsx`), next to the
URL field. Clicking it opens a small dropdown with:

1. A zoom row — `🔍  −   100%   +` — decrease/increase zoom, and click the
   magnifying glass to reset to 100%.
2. A divider.
3. `Developer Options (Coming Soon)` — visibly disabled, no click handler.
   Placeholder for the DevTools sidebar planned in
   `2026-08-05-browser-panel-design.md` §"DevTools sidebar" (not yet built).

Zoom must stay scoped to the browser tab's own guest content only — it must
never affect the host app's own UI scale. This is already true of the
existing Cmd+/- keyboard shortcut; the new menu just needs to keep using the
same mechanism rather than introduce a second one.

## Why this needs more than a UI component

Zoom is currently entirely inside the main process. `browserViews.ts`'s
`before-input-event` handler calls `wc.setZoomLevel()` directly in response
to Cmd+/-/0, with zero state exposed to the renderer. There is no way today
for any UI to know what the current zoom level is. To show a live, accurate
"100%" in the menu, the renderer needs to both **read** and **change** zoom
through a real IPC surface, and the keyboard shortcut and the menu must never
be able to drift out of sync with each other.

## Main process (`electron/browserViews.ts`)

- Extract the keyboard handler's zoom logic into one private method:
  ```ts
  private setZoom(id: string, level: number): void {
    const wc = this.get(id)?.webContents
    if (!wc) return
    const clamped = Math.max(-8, Math.min(9, level))
    wc.setZoomLevel(clamped)
    this.sendEvent(id, { type: 'zoom-changed', level: clamped })
  }
  ```
  (`sendEvent` is the existing `send()` closure per guest, promoted to a
  shared private method so both `wireEvents` and the new IPC handlers can use
  it.)
- The `before-input-event` handler's three zoom branches call
  `this.setZoom(id, wc.getZoomLevel() + 1)` / `- 1` / `this.setZoom(id, 0)`
  instead of touching `wc` directly.
- Three new `ipcMain.handle` registrations, each resolving the *current*
  guest's zoom level so they can compute the delta the same way the keyboard
  handler does:
  - `browserView:zoomIn(id)` → `this.setZoom(id, (this.get(id)?.webContents.getZoomLevel() ?? 0) + 1)`
  - `browserView:zoomOut(id)` → same, `- 1`
  - `browserView:zoomReset(id)` → `this.setZoom(id, 0)`
- `BrowserViewEvent` union gains `{ type: 'zoom-changed'; level: number }`.

No new session/window-level zoom API is touched — `win.webContents` (the
host UI) is never involved, so the host app's own scale cannot be affected
by anything this feature does.

## Preload (`electron/preload.ts`) / types (`src/types/api.d.ts`)

Three new thin wrappers mirroring the existing `browserView*` calls:
`browserViewZoomIn(id)`, `browserViewZoomOut(id)`, `browserViewZoomReset(id)`,
each `ipcRenderer.invoke(...)` returning `Promise<void>`. `BrowserViewEvent`'s
type import already covers the new union member automatically.

## Renderer state (`src/stores/browserStore.ts`)

- `BrowserTabState` gains `zoomLevel: number` (default `0`, i.e. 100%).
- `BrowserTab.tsx`'s existing `onBrowserViewEvent` switch gains a
  `case 'zoom-changed':` branch that calls
  `updateTab(browserId, { zoomLevel: event.level })`.

This is the single source of truth: whether the level changed via the
keyboard shortcut or the new menu buttons, the same event updates the same
field, so the displayed percentage is always accurate regardless of which
path changed it.

## UI (`src/components/Browser/BrowserTab.tsx`)

- New small SVG icon component (matching the existing `NavArrowIcon` /
  `ReloadIcon` style already in this file) for the vertical triple dot,
  added as a button at the end of the toolbar row, after the URL form.
- Clicking it toggles local `menuOpen` state and opens a dropdown positioned
  and clamped exactly like the file-tree/Git-panel context menus fixed
  earlier tonight: measure the actual rendered menu via `useLayoutEffect` +
  `clampToViewport` (`src/components/ui/clampToViewport.ts`), close on
  outside click / Escape.
- Displayed zoom percentage: `Math.round(1.2 ** zoomLevel * 100)` — Electron's
  standard zoom level → factor formula, matching what Chromium itself uses.
- Row buttons call `window.api.browserViewZoomIn/ZoomOut/ZoomReset(browserId)`
  — no optimistic local update; the row re-renders once the `zoom-changed`
  event lands, which is effectively instant since it's a same-process IPC
  round trip.
- `Developer Options (Coming Soon)` rendered as a static, visually-disabled
  row (dimmed text, no `onClick`, `cursor-not-allowed`) — same convention
  already used for `To Do (Coming Soon)` in the activity bar.

## Testing

- Manual verification in the running app (as with the rest of tonight's
  browser work) — `<webview>`/`WebContentsView` zoom behavior doesn't run
  under jsdom/vitest.
- Unit-testable: the percentage-from-level formula, if pulled into a small
  pure function, and `browserStore`'s new `zoomLevel` field's default/update
  behavior (same pattern as existing `updateTab` tests, if any exist —
  otherwise this is simple enough not to need a dedicated test).
