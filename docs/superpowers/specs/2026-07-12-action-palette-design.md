---
title: Action Palette & Terminal Tabs
date: 2026-07-12
status: approved
---

# Action Palette (Cmd+Shift+P) & Terminal as Editor Tab

## Overview

Two connected changes:
1. **Remove** the bottom terminal panel entirely.
2. **Add** terminals as first-class editor tabs — multiple instances, splittable with Cmd+D.
3. **Add** Cmd+Shift+P action palette for triggering commands (open terminal, git views, settings, switch assistant).

## Terminal as Editor Tab

### IPC (Electron main — PtyManager)

`PtyManager` changes from a single `proc` to a `Map<string, IPty>`. All IPC calls now include a terminal ID:

| Old | New |
|---|---|
| `term:spawn` → no args | `term:spawn(id, cwd?)` |
| `term:write(data)` | `term:write(id, data)` |
| `term:resize(cols, rows)` | `term:resize(id, cols, rows)` |
| `term:data` → `(data)` | `term:data` → `(id, data)` |
| — | `term:kill(id)` |

### Tab Path Convention

```ts
// terminal://term-abc123
isTerminalTab(path)   // path.startsWith('terminal://')
buildTerminalPath(id) // 'terminal://' + id
getTerminalId(path)   // path.slice('terminal://'.length)
```

IDs are generated as `Date.now().toString(36)` — short, unique per session.

### TerminalTab Component

`src/components/Terminal/TerminalTab.tsx` — replaces the old `Terminal.tsx`. Takes `terminalId` as prop. Mounts XTerm, calls `term:spawn(id, projectRoot)`, subscribes to `onTermData` filtered by ID. Kills PTY on unmount via `term:kill(id)`. Reacts to theme/font/size changes exactly as before.

Rendered in `EditorPane` when `isTerminalTab(activeTab.path)` — same pattern as GitGraphPage, GitLogView, etc.

### Removed
- `src/stores/terminalStore.ts`
- `src/components/Terminal/Terminal.tsx`
- Bottom terminal panel from `App.tsx` layout
- Ctrl+` keybinding

## Action Palette

### Command Registry (`commands.ts`)

```ts
interface Command {
  id: string
  label: string
  description?: string
  keywords?: string[]
  condition?: () => boolean   // if absent, always shown
  action: () => void
}
```

Commands (all require `projectRoot` to be set, checked in the palette):

| id | label | condition |
|---|---|---|
| `new-terminal` | New Terminal | — |
| `git-graph` | Git: Graph | — |
| `git-log` | Git: Log | — |
| `git-branch-diff` | Git: Branch Diff | — |
| `settings-display` | Settings: Display | — |
| `settings-editor` | Settings: Editor | — |
| `settings-git` | Settings: Git | — |
| `switch-to-codex` | Switch to Codex | assistant === 'claude' |
| `switch-to-claude` | Switch to Claude | assistant === 'codex' |

### ActionPalette Component

`src/components/Search/ActionPalette.tsx` — same modal shape as CommandPalette. No async loading — filters the static command array synchronously. Shows `label` + `description`. Arrow keys, Enter, Escape.

### Store & Keybinding

`searchStore` gains `actionPaletteOpen`, `openActionPalette`, `closeActionPalette`.

Registered in App.tsx keydown handler (`metaKey + shiftKey + p`) and in Monaco `onMount` (`CtrlCmd | Shift | KeyP`).
