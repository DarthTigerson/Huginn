# Mobile web pages rebuild: theme sync, wake lock, responsive layout

## Problem
The pages served to a connected phone (`electron/mobile.ts`: pin entry,
app list, Claude Usage) are hand-built as JS template-literal strings with
inline styles, hardcoded to one dark palette. Three related issues:

1. They never match the IDE's active theme, or react when it changes
   (including macOS's own sunset-based Auto appearance switching, which
   the IDE already follows via `useThemeStore`'s "Match system" mode).
2. The screen keeps sleeping on iOS. Root cause: the Wake Lock API
   requires a secure context, and the phone loads the page over
   `http://<lan-ip>:<port>` — Safari on iOS treats that as insecure, so
   `navigator.wakeLock.request()` throws and is silently swallowed.
3. There's no landscape/tablet layout — the fixed centered-column design
   clips content on short viewports and wastes space on wide ones.

## Design

### File layout
New `electron/mobileWeb/` directory of plain static assets (no build
step — modern ES modules run directly in Safari/Chrome):

```
electron/mobileWeb/
  style.css     # theme variables (ported from src/index.css) + responsive layout
  app.js        # shared: theme poll+apply, no-sleep trick, fullscreen-on-tap
  pin.html
  home.html     # was appListPage() / "/app"
  usage.html
  usage.js      # gauge/chart rendering + usage poll, migrated from inline JS
```

`MobileServer` (`electron/mobile.ts`) serves these from disk via
`app.getAppPath()`-relative paths (correct in dev today; if the app is
ever packaged, asset bundling can be revisited then — not needed yet
since there's no packaging config currently). Files are read fresh per
request (not cached) so they can be edited and refreshed on the phone
without restarting Huginn — these are small local files, the cost is
negligible.

Routes are unchanged: `/` → pin.html, `/app` → home.html,
`/app/claude-usage` → usage.html. New: `/mobile-assets/*` serves
style.css/app.js/usage.js with correct content types.

Two request-time placeholders are substituted into the HTML text before
serving (simple string replace, no templating engine needed):
- `%%THEME%%` → current theme id, for correct first paint with no flash.
- `%%PIN_ERROR%%` → the "Incorrect PIN" message on pin.html, when present.

### Theme + font sync
`MobileServer` gains `currentTheme: ThemeId` (default `claude-dark`) and
`currentFont: string` (default `Menlo, monospace`, matching
`displayStore`'s own default) fields, plus a `setDisplay(theme, font)`
method wired to a new IPC channel `mobile:setDisplay` (fire-and-forget
`ipcRenderer.send`, not part of the existing `MobileState`/`mobile:state`
round-trip used by the desktop panel — this is phone-only state).

`App.tsx` adds:
```ts
const theme = useThemeStore((s) => s.theme)
const font = useDisplayStore((s) => s.font)
useEffect(() => { window.api.mobileSetDisplay(theme, font) }, [theme, font])
```
This fires on mount and on every change, which covers manual theme/font
switches and `matchSystem`'s OS-driven (sunset) switch, since all paths
update the respective store's state.

`/api/state` (already exists, currently returns `{connectedCount}`) gains
`theme` and `font`. `app.js`'s shared poll loop (every 10s — separate from
the 60s usage-data poll, since this should feel responsive) fetches it and:
- sets `document.documentElement.dataset.theme = theme`, mirroring exactly
  how the desktop app applies themes via `[data-theme="..."]` in
  `src/index.css`. `style.css` ports the same 6 palettes
  (claude/codex/thomas × dark/light) as CSS custom properties under
  `[data-theme="..."]` blocks — same variable names and values as
  `index.css`, so there's one source of truth to eyeball when a theme is
  tweaked (kept as a second copy since it's a different CSS file for a
  different runtime target; not worth a shared-build step for 6 small
  blocks).
- sets `document.documentElement.style.setProperty('--font-mono', font)`,
  the same mechanism `displayStore.applyFont()` uses. `style.css`'s body
  rule becomes `font-family: var(--font-mono), -apple-system,
  BlinkMacSystemFont, sans-serif;` so the phone renders in whatever
  monospace font is chosen in Settings, falling back to the system sans
  font on values the OS doesn't have installed (Monaco/Consolas aren't
  present on iOS — same accepted fallback the desktop picker already
  documents; Menlo and Courier New are, and render correctly).

### Wake lock
`app.js` replaces the Wake Lock API attempt with the canvas
`captureStream()` → hidden `<video>` trick: a 1×1 canvas streamed into a
muted, autoplaying, looping `<video>` element keeps iOS Safari from
sleeping the screen, without needing a secure context or an embedded
media file. The real Wake Lock API call stays too, gated behind
`'wakeLock' in navigator`, as a harmless no-op enhancement for contexts
where it would actually work.

### Responsive / landscape layout
`style.css` replaces the current clipped centered-flex body with:
- A scrollable body (`overflow-y: auto` instead of a fixed-height flex
  center that clips on short viewports).
- Fluid spacing/type sizing via `clamp()`.
- A `@media (min-width: 700px) and (orientation: landscape)` breakpoint
  (phones-in-landscape and tablets) that widens the max content width and
  switches the usage page's two gauges + two stat cards from a stacked
  column into a single 4-column row, and puts the back-link/title/updated
  time in a proper top bar instead of a cramped inline row.

## Out of scope
- No packaging/asset-bundling work for a distributed build (project isn't
  packaged yet).
- No new client-side router or framework — three routes stay three static
  HTML files.
- No change to the pairing/PIN/session auth flow itself.

## Testing
- Existing Vitest suite doesn't cover `electron/mobile.ts` HTML output
  directly (no test file for it currently) — add a small test asserting
  `/api/state` includes `theme`/`font` and that `mobile:setDisplay`
  updates them.
- Manual check: open the served pages in a browser at a few widths
  (portrait phone, landscape phone, landscape tablet) and toggle the IDE
  theme to confirm the phone view picks it up within ~10s.
