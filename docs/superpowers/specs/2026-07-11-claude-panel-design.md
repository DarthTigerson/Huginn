# Claude Panel — Design Spec

**Date:** 2026-07-11
**Status:** Approved

## Overview

Replace the `Chat.tsx` stub with a live xterm.js terminal that automatically spawns the `claude` CLI in the currently open project directory. The Claude panel is always visible in the right column of the IDE and gives the user a persistent Claude Code session tied to their project.

---

## Architecture

One new main-process file, four IPC additions, and a replacement of the renderer stub:

- **`electron/claude.ts`** — `ClaudeManager` class. Mirrors `PtyManager` in structure. On `claude:spawn(cwd)` it spawns the `claude` binary via node-pty in the given directory. Streams output to the renderer via `claude:data` IPC push. Handles `claude:write` (stdin) and `claude:resize` (pty resize). Catches spawn errors and pushes a human-readable message to the renderer instead of crashing.
- **`electron/main.ts`** — instantiates `ClaudeManager` alongside `PtyManager` and calls `registerHandlers()`.
- **`electron/preload.ts`** — four new methods added to the `contextBridge`: `claudeSpawn(cwd)`, `claudeWrite(data)`, `claudeResize(cols, rows)`, `onClaudeData(cb)`.
- **`src/types/api.d.ts`** — typed signatures for the four new `window.api` methods.
- **`src/components/Chat/Chat.tsx`** — replaced entirely. Becomes an xterm.js terminal component.

---

## IPC Channels

| Channel | Direction | Type | Purpose |
|---|---|---|---|
| `claude:spawn` | renderer → main | invoke | Spawn `claude` in `cwd` |
| `claude:write` | renderer → main | send | Send keystrokes to claude stdin |
| `claude:resize` | renderer → main | send | Resize the pty |
| `claude:data` | main → renderer | push | Stream claude stdout to xterm |

All channel names follow the existing `namespace:action` convention.

---

## Component Behaviour

`Chat.tsx` (renamed conceptually to the Claude panel) is an xterm.js terminal with the same configuration as `Terminal.tsx`:
- Same theme (`background: '#1a1a1a'`, same foreground/cursor colours)
- Same font (SF Mono, 13px, cursorBlink, convertEol)
- FitAddon + ResizeObserver for automatic sizing
- Header bar: label "Claude", no close button (panel is always visible)

On mount:
1. Read `projectRoot` from `useFileStore`.
2. If `projectRoot` is null → render a placeholder message: *"Open a folder to start Claude"*. Do not spawn.
3. If `projectRoot` is set → initialise xterm, call `window.api.claudeSpawn(projectRoot)`, wire `onClaudeData` → `xterm.write`, wire `xterm.onData` → `claudeWrite`.

No auto-respawn on project change — Claude sessions are stateful; the user manages them.

---

## Edge Cases

**No project open:** Panel shows a centred placeholder message instead of an xterm instance. If the user later opens a folder, the placeholder remains until the app is restarted or the panel remounts (keeping behaviour simple and predictable).

**`claude` not in PATH:** `ClaudeManager` wraps the `pty.spawn` call in a try/catch. On error it sends a readable message to the renderer via `claude:data`:
```
Error: 'claude' not found in PATH.
Install it with: npm install -g @anthropic-ai/claude-code
```

**Second spawn attempt:** `ClaudeManager` guards against double-spawn with `if (this.proc) return`, same as `PtyManager`.

---

## Out of Scope

- Auto-respawn when the project root changes
- Restart / kill button in the panel header
- Multiple Claude sessions
