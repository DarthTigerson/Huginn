# Mobile Display — Design Spec

**Date:** 2026-07-12  
**Status:** Approved

## Summary

Add a "Mobile Display" panel to Huginn's left ActivityBar. Clicking an iPhone icon (positioned after the Todos icon) toggles an empty side panel. This is a placeholder — future sessions will populate the panel with actual mobile preview content.

## Architecture

No new state management. The existing `leftPanel` state in `App.tsx` already handles this pattern:

```ts
// Before
type LeftPanel = 'files' | 'git' | 'todos' | 'settings' | null

// After
type LeftPanel = 'files' | 'git' | 'todos' | 'mobile' | 'settings' | null
```

The left panel area already renders the correct component based on `leftPanel` value. Adding `'mobile'` is a single branch in that switch.

## Components

### `PhoneIcon` (in `ActivityBar.tsx`)
- New SVG icon exported from `ActivityBar.tsx`, consistent with `FilesIcon`, `GitIcon`, `TodoIcon`, etc.
- Renders an outline smartphone/iPhone shape at the same 16×16 or 20×20 size used by sibling icons.

### `MobileDisplayPanel` (`src/components/MobileDisplay/MobileDisplayPanel.tsx`)
- Empty placeholder panel, visually consistent with `TodoPanel`, `GitPanel`, etc.
- Shows a header with title "Mobile Display" and an empty body for now.

### `App.tsx` changes
- Extend `leftPanel` type union to include `'mobile'`.
- Add `PhoneIcon` to the top group of the left ActivityBar, after the `todos` entry.
- Add `leftPanel === 'mobile' ? <MobileDisplayPanel /> : ...` to the panel render branch.

## Placement

Left ActivityBar top group order (after change):

1. Files
2. Git
3. Todos
4. **Mobile Display** ← new

## Out of Scope (for now)

- Actual mobile preview/iframe content
- Device frame rendering
- Responsive breakpoint controls
