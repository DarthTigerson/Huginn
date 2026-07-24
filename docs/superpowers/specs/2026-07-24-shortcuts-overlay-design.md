---
title: Hold-to-Show Keyboard Shortcuts Panel
date: 2026-07-24
status: approved
---

# Hold-to-Show Keyboard Shortcuts Panel

## Overview

Holding Cmd (or Ctrl) alone for ~450ms brings up a centered overlay listing Huginn's custom
keyboard shortcuts, grouped by category — similar to iPadOS's shortcut discoverability HUD.
Releasing the modifier, pressing Escape, pressing any other key, losing window focus, or having
another modal already open all prevent/dismiss it.

## Shortcut Registry

`src/components/Shortcuts/shortcuts.ts` — static data, the first central list of Huginn's custom
shortcuts (today they're scattered across `App.tsx`, `Editor.tsx`, and `electron/main.ts` with no
shared source of truth). Manually maintained; adding a new global shortcut means adding an entry
here too.

```ts
interface ShortcutEntry {
  keys: string[]      // e.g. ['⌘', 'B'] — rendered as separate key-cap chips
  label: string
}
interface ShortcutGroup {
  category: string
  items: ShortcutEntry[]
}
```

Content:

| Category | Keys | Label |
|---|---|---|
| Navigation | ⌘B | Toggle Sidebar |
| Navigation | ⌘P | Command Palette |
| Navigation | ⌘⇧P | Action Palette |
| Navigation | ⌘F | Search |
| Navigation | ⌘T | New Terminal |
| Editor | ⌘S | Save |
| Editor | ⌘D | Split Pane Horizontal |
| Editor | ⌘⇧D | Split Pane Vertical |
| Project | ⌘W | Close Tab |
| Project | ⌘⇧O | Open Project |

On non-Mac (Ctrl as the held modifier), render `Ctrl` instead of `⌘` — cosmetic only, resolved at
render time from `navigator.platform`/`userAgent`, not stored per-entry.

## Trigger State & Timing

Owned by `searchStore` (already home to the other overlay-open booleans: `commandPaletteOpen`,
`searchOpen`, `actionPaletteOpen`):

```ts
shortcutsOverlayOpen: boolean
openShortcutsOverlay: () => void
closeShortcutsOverlay: () => void
```

A new hook, `useHoldToShowShortcuts`, wired into `App.tsx` alongside the existing global keydown
effect, owns the timer/listener logic:

- On `keydown` where `(e.metaKey || e.ctrlKey)` and the pressed key is itself a modifier
  (Meta/Control/Shift/Alt) — i.e. no non-modifier key yet — start a 450ms timer if one isn't
  already running.
- If the timer elapses while the modifier is still held and no non-modifier key has been pressed,
  and no other search-store modal is open (`commandPaletteOpen`, `searchOpen`, `actionPaletteOpen`),
  call `openShortcutsOverlay()`.
- On `keydown` of any non-modifier key: clear the pending timer; if the overlay is open, close it
  (the shortcut fires via the existing independent handlers in `App.tsx`/`Editor.tsx` — this hook
  never intercepts or calls `preventDefault`, it only observes).
- On `keyup` of Meta/Ctrl: clear the timer and close the overlay if open.
- On `window.blur`: clear the timer and close the overlay if open (covers Cmd+Tab losing the keyup
  event).
- Escape closes the overlay (handled the same way the other modals already close on Escape).

## ShortcutsOverlay Component

`src/components/Shortcuts/ShortcutsOverlay.tsx` — visually matches the existing
`CommandPalette`/`ActionPalette`/`SearchModal` shape: `fixed inset-0 bg-black/60` backdrop, a
centered rounded card (`bg-sidebar border border-border rounded-xl shadow-2xl`). No input field —
just the grouped, static list. Each row shows key-cap chip(s) + label. Rendered in `App.tsx`
alongside the other conditionally-rendered overlays, gated on `shortcutsOverlayOpen`.

## Testing

`useHoldToShowShortcuts` covered with Vitest fake timers:
- holding the modifier alone past 450ms opens the overlay
- pressing a non-modifier key before 450ms elapses never opens it (and clears the timer)
- pressing a non-modifier key while already open closes it
- keyup of the modifier before 450ms cancels the timer
- window blur while open closes it
- overlay does not open if another search-store modal is already open
