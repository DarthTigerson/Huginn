# Git Graph Page — Design Spec

**Date:** 2026-07-12  
**Status:** Approved

---

## Overview

Add a git commit history graph page to the Git panel. Opened via the existing "Graph" pill button in `GitPanel.tsx`, it renders in the editor area as a virtual tab (following the established page pattern). It shows the last 100 commits across all local branches with colour-coded lane lines, and a detail panel that slides in when a commit is selected.

---

## Data Layer

### IPC handler: `git:graph`

New handler in `electron/git.ts` runs:

```
git log --all -n 100 --pretty=format:'%H|%P|%s|%an|%ai|%D'
```

Returns an array of `GitCommit` objects parsed from that output:

```ts
interface GitCommit {
  hash: string       // full SHA
  parents: string[]  // parent SHAs (empty for root commits)
  subject: string    // first line of commit message
  author: string
  date: string       // ISO 8601
  refs: string[]     // e.g. ["HEAD -> main", "origin/main", "v1.0"]
}
```

Exposed via `window.api.gitGraph(cwd: string): Promise<GitCommit[]>` (preload + main wiring).

### Store: `gitGraphStore`

Zustand store at `src/stores/gitGraphStore.ts`:

```ts
interface GitGraphStore {
  commits: GitCommit[]
  selectedHash: string | null
  loading: boolean
  load: (cwd: string) => Promise<void>
  select: (hash: string | null) => void
}
```

`load` sets `loading: true`, calls `window.api.gitGraph(cwd)`, stores result, sets `loading: false`.

### Tab path

`git-graph://Graph` — registered in `src/components/Settings/paths.ts` alongside the existing constants.

---

## Layout Algorithm

Pure function `computeLayout(commits: GitCommit[]): LayoutCommit[]` in `src/components/Git/graphLayout.ts`.

```ts
interface Connector {
  fromLane: number
  toLane: number
  type: 'straight' | 'merge-in' | 'branch-out'
}

interface LayoutCommit {
  commit: GitCommit
  lane: number
  color: string
  connectors: Connector[]
}
```

**Algorithm:**

1. Maintain `activeLanes: (string | null)[]` — each slot holds the hash it is "waiting for" as its next expected parent.
2. Walk commits top-to-bottom (as returned by git log, newest first).
3. For each commit:
   - Find the first lane already waiting for this commit's hash → that is the commit's lane. If none, push a new lane.
   - Clear this commit's hash from its lane slot.
   - For each parent hash: assign it to the commit's lane (first parent) or find/open another lane for subsequent parents.
   - Emit `Connector` entries for each parent: straight if same lane, bezier arc if different lane.
4. Lane colors cycle through a fixed 8-color palette derived from the accent color and complementary hues. Palette is defined as CSS custom-property references so it automatically respects the active theme.

The function is pure and has no side effects — easy to unit test.

---

## UI

### Page component: `GitGraphPage`

Located at `src/components/Git/GitGraphPage.tsx`. Full-height flex row:

**Graph + list panel** (flex-1, always visible):
- Scrollable list, one row per commit
- Each row: fixed-width SVG column (~160px) + commit info
- SVG column: renders the dot at this commit's lane and all connector paths crossing this row's vertical slice
- Commit info: subject (truncated), author, relative date, ref badges (branch/tag chips)
- Selected row gets a subtle highlight background
- Click → `store.select(hash)`

**Detail panel** (fixed ~340px wide, slides in when `selectedHash !== null`):
- Short hash (monospace, click to copy full hash)
- Full subject
- Author + ISO date
- Changed files list (from `git show --stat` via a new `window.api.gitShowStat(cwd, hash)` IPC call)
- Files are display-only in this version (no click-to-diff)
- Close button clears `selectedHash`

### Wiring

**`src/components/Settings/paths.ts`** — add:
```ts
export const GIT_GRAPH_TAB_PATH = 'git-graph://Graph'
export function isGitGraphTab(path: string): boolean {
  return path === GIT_GRAPH_TAB_PATH
}
```

**`src/components/Editor/Editor.tsx`** — add `isGitGraph` check alongside `isGitLog`, render `<GitGraphPage />`.

**`src/components/Git/GitPanel.tsx`** — wire "Graph" pill button to open the tab and call `gitGraphStore.getState().load(projectRoot)`.

---

## File Inventory

| File | Action |
|------|--------|
| `electron/git.ts` | Add `getGitGraph()` and `getGitShowStat()` functions |
| `electron/main.ts` | Register `git:graph` and `git:showStat` IPC handlers |
| `electron/preload.ts` | Expose `gitGraph` and `gitShowStat` on `window.api` |
| `src/types/index.ts` | Add `GitCommit`, `LayoutCommit`, `Connector` interfaces |
| `src/types/api.d.ts` | Add `gitGraph` and `gitShowStat` to the API type |
| `src/stores/gitGraphStore.ts` | New Zustand store |
| `src/components/Git/graphLayout.ts` | Pure layout algorithm |
| `src/components/Git/GitGraphPage.tsx` | Main page component |
| `src/components/Settings/paths.ts` | Add `GIT_GRAPH_TAB_PATH` and `isGitGraphTab` |
| `src/components/Editor/Editor.tsx` | Add `isGitGraph` routing |
| `src/components/Git/GitPanel.tsx` | Wire "Graph" button |

---

## Out of Scope

- Remote branch tracking lines (just show local + already-fetched refs)
- Infinite scroll / load-more (fixed 100 commits for now)
- Search / filter by author or message
- Checkout, cherry-pick, or other git actions from the graph
