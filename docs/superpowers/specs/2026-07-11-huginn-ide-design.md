# Huginn IDE — Design Spec

**Date:** 2026-07-11
**Status:** Approved

## Overview

Huginn is a desktop IDE built specifically for Claude. It is a React-based application packaged with Electron, styled to feel like a native macOS app in the VS Code tradition. The v1 scope covers the four core panels: file tree, code editor, terminal, and chat. The Claude integration will be designed in a subsequent spec.

---

## Architecture

Electron's two-process model is the foundation:

- **Main process** (`electron/main.ts`) — Node.js runtime. Owns all OS-level operations: filesystem reads and writes, spawning terminal shells via `node-pty`, window lifecycle, and the macOS menu bar.
- **Renderer process** (`src/`) — The React application. Everything the user sees and interacts with.
- **IPC bridge** (`electron/preload.ts`) — A `contextBridge` that exposes a typed `window.api` object to the renderer. All communication between React and the OS layer flows through this bridge.

Build tooling: `electron-vite`, which provides Vite HMR for the renderer and compiles the main/preload TypeScript with minimal configuration.

---

## Panel Layout

Four panels compose the UI:

| Panel | Position | Technology |
|---|---|---|
| File tree (Sidebar) | Left, resizable | Custom React tree component |
| Editor | Center | `@monaco-editor/react` |
| Chat | Right, resizable | Stub for Claude integration |
| Terminal | Bottom, toggleable | `xterm.js` + `node-pty` |

Layout mechanics are handled by `react-resizable-panels` — horizontal and vertical `PanelGroup`s are nested to produce the four-area split. Users can drag dividers to resize panels.

### macOS chrome
- `titleBarStyle: 'hiddenInset'` on the `BrowserWindow` — native traffic-light buttons appear inside the app's own chrome.
- `vibrancy: 'sidebar'` applied to the left sidebar for the frosted-glass effect native macOS apps use.
- `-apple-system` font stack everywhere; Tailwind CSS for layout and theming.

---

## State Management

Zustand with three stores:

### `fileStore`
- `projectRoot: string | null` — the open project directory
- `tree: FileNode[]` — the file tree structure
- `selectedPath: string | null` — currently selected file

File reads and writes are async calls through `window.api` → IPC → main process → `fs`.

### `editorStore`
- `tabs: Tab[]` — list of open files (path + content + dirty flag)
- `activeTabPath: string | null` — which tab is focused

### `terminalStore`
- `visible: boolean` — terminal drawer open/closed
- Terminal I/O flows over IPC: renderer sends keystrokes, main writes to the `node-pty` process and streams output back.

---

## Data Flow

Typical flow for opening a file:

```
File tree click
  → fileStore.select(path)
  → window.api.readFile(path)
  → IPC → main reads fs
  → IPC response
  → editorStore.openTab({ path, content })
  → Monaco renders content
```

Typical flow for terminal input:

```
User keystroke in xterm
  → window.api.termWrite(data)
  → IPC → main writes to node-pty
  → node-pty stdout
  → IPC push → renderer
  → xterm.write(data)
```

---

## Project Structure

```
huginn/
├── electron/
│   ├── main.ts          # BrowserWindow setup, IPC handlers
│   ├── preload.ts       # contextBridge — exposes window.api
│   └── pty.ts           # node-pty shell spawning
├── src/
│   ├── components/
│   │   ├── Sidebar/     # file tree
│   │   ├── Editor/      # tabs + Monaco
│   │   ├── Terminal/    # xterm.js panel
│   │   └── Chat/        # Claude panel (stub)
│   ├── stores/
│   │   ├── fileStore.ts
│   │   ├── editorStore.ts
│   │   └── terminalStore.ts
│   ├── App.tsx          # PanelGroup layout root
│   └── main.tsx
├── electron.vite.config.ts
└── package.json
```

---

## Technology Stack

| Concern | Choice |
|---|---|
| App shell | Electron + electron-vite |
| UI framework | React + TypeScript |
| Styling | Tailwind CSS |
| Editor | @monaco-editor/react |
| Terminal | xterm.js + node-pty |
| Panel layout | react-resizable-panels |
| State management | Zustand |
| macOS chrome | `hiddenInset` titlebar + `vibrancy: 'sidebar'` |

---

## Out of Scope (v1)

- Claude API integration and chat functionality (next spec)
- Git diff / changes panel
- Settings UI
- Plugin system
- Multi-window support
