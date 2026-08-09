# Huginn

A Claude-native IDE — an Electron desktop app built around terminal AI
coding agents, with a full editor, git tooling, and a mobile companion
display.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![GitHub release](https://img.shields.io/github/v/release/DarthTigerson/Huginn)

![Huginn main window](docs/screenshots/hero.png)

> **Not affiliated with Anthropic or OpenAI.** Huginn integrates the Claude
> Code CLI and the OpenAI Codex CLI as terminal agents, and includes a panel
> for connecting to any OpenAI-compatible local LLM endpoint ("Cosmos"). It
> is an independent, unofficial project — "Claude" and "Codex" are
> trademarks of their respective owners.

## What it is

Huginn wraps a Monaco-based code editor, a real terminal, and git tooling
around one or more AI coding agents running side-by-side, so you can drive
an agent and review/edit its changes in the same window instead of
switching between a browser, a terminal, and an editor.

## Features

- **Editor** — Monaco-based code editing with syntax highlighting and themes
- **Agent panels** — run Claude Code and Codex CLI as first-class panels,
  plus a "Cosmos" panel for any OpenAI-compatible local LLM endpoint
- **Git panel** — log/graph view, stage & commit, push/pull, all without
  leaving the app
- **Integrated terminal** — a real shell (via `node-pty`) alongside the
  agent panels
- **Mobile Display** — pair a phone over your local network (QR code + PIN)
  to view usage stats on a second screen
- **Usage tracking** — Claude usage/burn-rate monitoring built into the
  status bar
- **Command palette & shortcuts overlay** — keyboard-first navigation

| Git graph | Mobile Display |
|---|---|
| ![Git graph view](docs/screenshots/git-graph.png) | ![Mobile Display pairing](docs/screenshots/mobile-display.png) |

## Requirements

- macOS or Linux (Windows isn't supported yet)
- [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) and/or the
  [OpenAI Codex CLI](https://github.com/openai/codex) installed separately,
  for the agent panels you want to use — Huginn launches them, it doesn't
  bundle them

## Installation

Download the latest build for your platform from the
[Releases page](https://github.com/DarthTigerson/Huginn/releases):

- **macOS**: download the `.dmg`, open it, and drag Huginn to Applications.
  The build isn't code-signed yet (no Apple Developer account), so macOS
  Gatekeeper will refuse to open it with a normal double-click. Either
  right-click the app → **Open** → confirm in the dialog, or run:
  ```bash
  xattr -cr /Applications/Huginn.app
  ```
- **Linux**: download the `.deb` and install it:
  ```bash
  sudo dpkg -i huginn_*.deb
  ```

### Build from source

```bash
git clone https://github.com/DarthTigerson/Huginn.git
cd Huginn
npm install
npm run dev
```

To build your own installer:

```bash
npm run dist:mac    # produces a .dmg under release/
npm run dist:linux  # produces a .deb under release/
```

## Contributing

Issues and pull requests are welcome. This is an early-stage (`v0.1.0`)
project, so expect some rough edges.

## License

[MIT](LICENSE)
