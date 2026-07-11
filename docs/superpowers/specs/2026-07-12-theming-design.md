# Theming System Design

**Date:** 2026-07-12
**Status:** Approved

## Overview

Four themes: `claude-dark`, `claude-light`, `codex-dark`, `codex-light`. Runtime switching via CSS custom properties on `html[data-theme]`. Persisted to localStorage. Monaco and xterm update reactively.

---

## Architecture

### CSS Variables on `html[data-theme]`

All color tokens are CSS custom properties. Tailwind config references them via `var()`. The `html` element carries a `data-theme` attribute that activates the correct variable set. This means no rebuild is needed to switch themes — only the attribute changes.

`index.html` sets `data-theme="claude-dark"` as a hard-coded default to prevent a flash-of-wrong-theme on first load. The theme store reads localStorage on init and overrides immediately (synchronously, before React renders).

### Token Set

| Token | Usage |
|---|---|
| `--color-bg` | Body background, terminal background |
| `--color-panel` | Editor / main content area (`bg-panel`) |
| `--color-sidebar` | Sidebar, activity bar (`bg-sidebar`) |
| `--color-tab-bar` | Tab bar (`bg-tab-bar`) |
| `--color-border` | All borders (`border-border`) |
| `--color-accent` | Active indicators, links, accent highlights |
| `--color-fg` | Primary text |
| `--color-fg-muted` | Secondary / muted text |
| `--color-fg-subtle` | Very faint text (placeholders, hints) |

### Text Token Migration

Current Tailwind gray classes are hard-coded and won't invert for light themes. Replace across all component files:

| Replace | With |
|---|---|
| `text-white`, `text-gray-200`, `text-gray-300` | `text-fg` |
| `text-gray-400`, `text-gray-500` | `text-fg-muted` |
| `text-gray-600` | `text-fg-subtle` |

`text-gray-*` classes used as *intentional brand accents* (e.g., the Claude icon's terracotta fill) are left as-is.

---

## Palettes

### Claude Dark (default)
```
bg:       #1a1a1a    body / terminal
panel:    #1e1e1e    editor area
sidebar:  #252526    sidebar / activity bar
tab-bar:  #2d2d2d
border:   #3c3c3c
accent:   #d97757    Anthropic terracotta
fg:       #cccccc
fg-muted: #858585
fg-subtle:#555555
```

### Claude Light
```
bg:       #f3f3f3
panel:    #ffffff
sidebar:  #ececec
tab-bar:  #e8e8e8
border:   #e0e0e0
accent:   #c4613d    darkened terracotta (legible on white)
fg:       #1e1e1e
fg-muted: #717171
fg-subtle:#999999
```

### Codex Dark
```
bg:       #1a1a1a
panel:    #202020
sidebar:  #1a1a1a
tab-bar:  #202020
border:   #333333
accent:   #ffffff
fg:       #cccccc
fg-muted: #8a8a8a
fg-subtle:#555555
```

### Codex Light
```
bg:       #fafafa
panel:    #ffffff
sidebar:  #fafafa
tab-bar:  #f6f6f6
border:   #d0d7de
accent:   #0969da
fg:       #24292f
fg-muted: #6e7781
fg-subtle:#aaaaaa
```

---

## Theme Store (`src/stores/themeStore.ts`)

```typescript
export type ThemeId = 'claude-dark' | 'claude-light' | 'codex-dark' | 'codex-light'
```

- Reads `localStorage.getItem('huginn:theme')` on module init; defaults to `'claude-dark'`
- `setTheme(id)`: sets `document.documentElement.setAttribute('data-theme', id)`, writes localStorage, updates store state
- The attribute is set synchronously at module load (before React renders) so there is no FOUC

---

## Monaco Integration

Maps theme IDs to built-in Monaco themes:

| ThemeId | Monaco theme |
|---|---|
| `claude-dark` | `vs-dark` |
| `claude-light` | `vs` |
| `codex-dark` | `vs-dark` |
| `codex-light` | `vs` |

`Editor.tsx` subscribes to `useThemeStore` and passes the mapped value to `<MonacoEditor theme={monacoTheme} />`. Monaco re-renders the editor colors automatically when the `theme` prop changes.

---

## xterm Integration

Each ThemeId maps to an xterm `ITheme` object. `Terminal.tsx` holds the xterm instance in a ref and adds a second `useEffect` that watches `useThemeStore` — when the theme changes, it sets `xtermRef.current.options.theme = XTERM_THEMES[theme]`.

| ThemeId | background | foreground | cursor |
|---|---|---|---|
| `claude-dark` | `#1a1a1a` | `#cccccc` | `#d97757` |
| `claude-light` | `#f3f3f3` | `#1e1e1e` | `#c4613d` |
| `codex-dark` | `#1a1a1a` | `#cccccc` | `#ffffff` |
| `codex-light` | `#fafafa` | `#24292f` | `#0969da` |

---

## ThemesPage (`src/components/Settings/ThemesPage.tsx`)

React component rendered in `Editor.tsx` when `activeTab.path === 'settings://Themes'` (replaces the "coming soon" placeholder).

Layout: 2×2 grid of theme cards. Each card shows:
- Theme name ("Claude Dark", etc.)
- Color swatch strip — five small rectangles: bg, panel, sidebar, accent, border
- "Active" badge (accent-coloured pill) if this is the current theme
- Full-card click triggers `setTheme(id)`

Cards are sized to show a meaningful preview without being oversized. The active card has an accent-coloured ring.

---

## Files Changed

| File | Change |
|---|---|
| `index.html` | Add `data-theme="claude-dark"` to `<html>` |
| `src/index.css` | Add 4 `[data-theme]` variable blocks; `body` uses `var(--color-bg)` / `var(--color-fg)` |
| `tailwind.config.js` | Switch hardcoded hex to `var()` refs; add `fg`, `fg-muted`, `fg-subtle` tokens |
| `src/stores/themeStore.ts` | New Zustand store |
| `src/components/Settings/ThemesPage.tsx` | New interactive theme picker |
| `src/components/Editor/Editor.tsx` | Render `<ThemesPage />` for virtual tab; pass reactive Monaco theme |
| `src/components/Terminal/Terminal.tsx` | Reactive xterm theme via second useEffect |
| All component `.tsx` files | `text-gray-*` → `text-fg*` token migration |

---

## Out of Scope

- Custom Monaco token colors (syntax highlighting color per theme) — built-in `vs` / `vs-dark` is sufficient for now
- Additional settings beyond Themes
- System-preference-based auto-switching (`prefers-color-scheme`)
