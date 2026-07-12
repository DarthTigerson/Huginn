# Per-Pane Tab Bars with Cross-Pane Drag

**Date:** 2026-07-12
**Status:** Approved

## Problem

The split-pane editor (Cmd+D / Cmd+Shift+D) creates new panes but each pane has no tab bar of its own. There is a single global `<TabBar />` at the top of `Editor` that does not know which pane is active, so new panes have no way to switch files.

## Design

### Tab Model

Tabs remain global — there is no concept of a tab "belonging" to a pane. Every pane's tab bar shows all open tabs. The currently displayed file per pane is `paneTabs[paneId]`, which already exists in the store. This requires no structural store redesign.

### Store Change

Add one new action to `editorStore`:

```ts
setPaneActive(paneId: string, path: string) => void
```

Sets `activePaneId = paneId`, `activeTabPath = path`, and `paneTabs[paneId] = path`. This is the pane-aware equivalent of the existing `setActive`, which only operates on `activePaneId`.

### TabBar

`TabBar` gains a required `paneId: string` prop.

- **Active highlight**: reads `paneTabs[paneId]` instead of global `activeTabPath`
- **Tab click**: calls `setPaneActive(paneId, path)` — focuses the pane and shows the file in it
- **Drag reorder within same bar**: existing behaviour unchanged (reorders global tab list)
- **Cross-pane drop**: when a tab from pane A is dropped onto pane B's tab bar, calls `setPaneActive(targetPaneId, draggedPath)`. The source pane is unaffected. Detection uses the existing `dataTransfer` path: a drop that lands on a `TabBar` with a different `paneId` than the drag origin takes the cross-pane code path instead of the reorder code path.

### Editor Layout

- Remove the single `<TabBar />` from the top of `Editor`
- Each `EditorPane` renders `<TabBar paneId={paneId} />` above its content
- `EditorPane` already calls `setActivePane` on click focus; this remains

### Files Changed

| File | Change |
|------|--------|
| `src/stores/editorStore.ts` | Add `setPaneActive` action |
| `src/components/Editor/TabBar.tsx` | Accept `paneId` prop; use per-pane active; cross-pane drop |
| `src/components/Editor/Editor.tsx` | Remove top-level `<TabBar />`; pass `paneId` to `<TabBar>` inside `EditorPane` |
| `src/stores/__tests__/editorStore.test.ts` | Tests for `setPaneActive` |

## Out of Scope

- Closing a pane (no pane-close button in this change)
- Tabs owned exclusively by a pane
- Persisting pane layout across sessions
