# Huginn 

## v0.1.5 (2026-08-12)
- **Discard all changes**: clear every uncommitted change from the Git panel in one action
- **Reveal in site tree**: jump to a file in the sidebar from the Git commit details panel, and diff editors now auto-reveal their file in the tree
- Added a user preference for which branch the Git list view defaults to
- Git log terminal now respects your configured font size
- Improved reliability of the Git panel's periodic fetches
- The install script now requests admin rights (with a safe rollback if the update fails partway) when updating Huginn in /Applications, instead of failing silently

**Bug fixes**
- Fixed the commit details panel resetting when it lost focus
- Fixed the wrong default branch loading in the Git panel


## v0.1.4 (2026-08-12)
- **Go to Definition**: ⌘-click a symbol to jump to it, backed by real language servers for TypeScript/JavaScript, Python, Go, and Rust (opt-in per language in Settings > Editor)
- **Git Graph**: right-click a commit's file to open it or its diff, right-click a branch/tag to check it out, and List Diff now shares the same commit details panel as Git Graph
- **External To Do**: pin a task-tracking page as a browser tab, with a global on/off toggle and an option to auto-collapse the sidebar when opening it
- **Switch Project (⌃R)**: now jumps to the window a project is already open in, instead of reloading it in the current window or opening a duplicate
- Check for Updates is now available from the app menu
- Graphify's "Enable for Claude Code" now stages the generated skill files with git automatically
- Footer tips and the shortcuts overlay now cover the newer features (Go to Definition, Graphify, Mobile Display, To Do, browser tabs, Usage panel)

**Bug fixes**
- Right-click menus (file tree, Git panel, commit/branch context menus) no longer appear offset from the cursor or behind other panels under the "glossy" panel style
- The branch switcher palette no longer renders in the wrong place inside the Git panel
- Editor tabs and the diff viewer now refresh automatically when a file changes outside Huginn
- Git panel status has a polling fallback so it stays fresh even if the native file watcher misses a change
- Long branch names no longer overflow in the Git panel and status bar
- Git Graph spacing and pipeline rendering fixes


## v0.1.3 (2026-08-10)
- **Git panel**: redesigned with a branch switcher palette, quick force-push buttons, and right-click copy for commits
- **Themes**: added Luuk Dark/Light and a changelog preview shown after updates

**Bug fixes**
- Git panel no longer goes stale when files change outside the app
- Force-push safety modal now actually shows from the footer menu
- Fixed unreadable colours and white scrollbars in dark/light themes


## v0.1.2 (2026-08-10)
- Improved autocomplete logic and ui
- Implement graphiphy to reduce claude token usage aswell as speed up usage


## v0.1.1 (2026-08-09)
- Implemented quick repo change with Control + R
- Implemented notification system to show help messages and update notifications
- Added image and markdown viewers, fixed tree sync, dimmed ignored files


## v0.1.0 (2026-08-09)
- Switch distribution to curl-install script (zip/tar.gz instead of dmg/deb)