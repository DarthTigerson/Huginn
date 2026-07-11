# Settings Panel Shell — Design

## Goal

Add a Settings entry point to the app, scoped to just the navigation shell
for this iteration. The actual Themes page content/behavior (theme store,
CSS variables, markdown rendering, dark/light switching) is explicitly
**deferred** — the user will provide detailed instructions for that
separately. This spec only covers getting the button, panel, and a
placeholder "Themes" tab wired up.

## Architecture

The left sidebar area currently shows/hides a single `Sidebar` (file tree)
component, toggled by a `sidebarVisible` boolean in `App.tsx`. This spec
replaces that boolean with a tri-state `leftPanel: 'files' | 'settings' | null`
so that only one left-panel view can be open at a time — opening Settings
naturally closes the file tree (and vice versa) without any extra
coordination code.

## Components

1. **`App.tsx`**
   - Replace `sidebarVisible` state with `leftPanel` state (default `'files'`).
   - Left `ActivityBar` gets a new `bottomGroups` entry: a Settings button
     (gear icon), pinned to the bottom of the bar. `active` reflects
     `leftPanel === 'settings'`; `onClick` toggles `leftPanel` between
     `'settings'` and `null`.
   - The existing Explorer button's `onClick` toggles `leftPanel` between
     `'files'` and `null` (same behavior as today, just reading/writing the
     new state).
   - The rendered `Panel` for the sidebar slot shows `<Sidebar />` when
     `leftPanel === 'files'` and `<SettingsPanel />` when
     `leftPanel === 'settings'`.

2. **`src/components/ActivityBar/ActivityBar.tsx`**
   - Add a `SettingsIcon` export (gear icon, matching the existing
     stroke-based icon style used by `FilesIcon` etc.).

3. **`src/components/Settings/SettingsPanel.tsx`** (new)
   - Mirrors the visual shell of `Sidebar.tsx` (header + list), but with a
     single static list containing one row: "Themes".
   - Clicking "Themes" opens a tab via the existing `editorStore.openTab`,
     using a virtual path `settings://Themes` (not a real file).

4. **`src/components/Editor/Editor.tsx`**
   - When `activeTab.path === 'settings://Themes'`, render a small
     placeholder component (e.g. "Themes — coming soon") instead of
     Monaco.
   - Guard the existing Cmd+S save handler to skip any tab whose path
     starts with `settings://`, since there's no real file to write.

## Data flow

Click Settings button → `leftPanel` set to `'settings'` (and file tree
panel unmounts) → `SettingsPanel` renders → click "Themes" row →
`editorStore.openTab({ path: 'settings://Themes', content: '', dirty: false })`
→ this shows up as a real tab in the existing tab bar, alongside open
files → `Editor` recognizes the virtual path and renders the placeholder
view instead of Monaco.

## Error handling

No new failure modes — this is pure client-side React state, no IPC or
filesystem access. The only defensive change is the Cmd+S guard described
above, preventing an accidental `writeFile('settings://Themes', ...)` call.

## Explicitly out of scope (for a future spec)

- Theme store (`dark`/`light` state, persistence)
- CSS variables / Tailwind color token changes
- Markdown rendering of the Themes page content
- Interactive theme switching
- Monaco / terminal theme swapping

## Testing

No new unit tests needed beyond what exists — this is a UI wiring change
with no new store logic. Manual verification: click Settings, confirm file
tree closes and Settings panel with "Themes" row appears; click Themes,
confirm a tab opens showing the placeholder; click Explorer, confirm
Settings panel closes and file tree reopens; confirm Cmd+S while the
Themes tab is active does nothing.
