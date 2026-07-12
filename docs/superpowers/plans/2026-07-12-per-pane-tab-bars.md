# Per-Pane Tab Bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each split editor pane its own tab bar that shows all open tabs, highlights its own active file, and supports dragging tabs both within the bar (reorder) and between panes (switch view).

**Architecture:** Add `setPaneActive(paneId, path)` to the store so clicking a tab in any pane focuses that pane and shows the file in it. `TabBar` gains a required `paneId` prop and reads `paneTabs[paneId]` for its active highlight. Cross-pane drag is detected by comparing the `paneId` stored in `dataTransfer` at drag-start against the drop-target pane. `Editor` removes its top-level `<TabBar />` and `EditorPane` renders `<TabBar paneId={paneId} />` inside a flex-col wrapper.

**Tech Stack:** React, Zustand, Vitest, Tailwind CSS

## Global Constraints

- No new dependencies
- All existing tests must continue to pass
- Follow existing Tailwind token names (`bg-panel`, `text-fg-muted`, `border-border`, `text-accent`, `bg-tab-bar`, etc.)
- Use `application/x-huginn-pane` as the dataTransfer MIME key for pane identity

---

### Task 1: Add `setPaneActive` to editorStore

**Files:**
- Modify: `src/stores/editorStore.ts`
- Modify: `src/stores/__tests__/editorStore.test.ts`

**Interfaces:**
- Produces: `setPaneActive(paneId: string, path: string) => void` on `useEditorStore`

- [ ] **Step 1: Write the failing tests**

Append to `src/stores/__tests__/editorStore.test.ts`:

```ts
it('setPaneActive sets activePaneId, activeTabPath, and paneTabs for the named pane', () => {
  const store = useEditorStore.getState()
  store.openTab({ path: '/a.ts', content: '', dirty: false })
  store.openTab({ path: '/b.ts', content: '', dirty: false })
  // Manually inject a second pane
  useEditorStore.setState({
    layout: {
      type: 'split',
      direction: 'horizontal',
      children: [
        { type: 'pane', id: 'pane-1' },
        { type: 'pane', id: 'pane-2' },
      ],
    },
    paneTabs: { 'pane-1': '/a.ts', 'pane-2': '/b.ts' },
    activePaneId: 'pane-1',
  })

  store.setPaneActive('pane-2', '/a.ts')

  const s = useEditorStore.getState()
  expect(s.activePaneId).toBe('pane-2')
  expect(s.activeTabPath).toBe('/a.ts')
  expect(s.paneTabs['pane-2']).toBe('/a.ts')
  expect(s.paneTabs['pane-1']).toBe('/a.ts') // untouched
})

it('setPaneActive is a no-op for a pane not in the layout', () => {
  const store = useEditorStore.getState()
  store.openTab({ path: '/a.ts', content: '', dirty: false })
  const before = useEditorStore.getState()

  store.setPaneActive('pane-999', '/a.ts')

  const after = useEditorStore.getState()
  expect(after.activePaneId).toBe(before.activePaneId)
  expect(after.activeTabPath).toBe(before.activeTabPath)
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/thomas/Documents/huginn && npx vitest run src/stores/__tests__/editorStore.test.ts 2>&1 | tail -20
```

Expected: two new tests fail with "store.setPaneActive is not a function"

- [ ] **Step 3: Add `setPaneActive` to the store interface and implementation**

In `src/stores/editorStore.ts`, add to the `EditorState` interface (after `setActivePane`):

```ts
setPaneActive: (paneId: string, path: string) => void
```

Add the implementation inside `create<EditorState>((set, get) => ({`, after the `setActivePane` action:

```ts
setPaneActive: (paneId: string, path: string) =>
  set((state) => {
    const paneIds = collectPaneIds(state.layout)
    if (!paneIds.includes(paneId)) return state
    return {
      activePaneId: paneId,
      activeTabPath: path,
      paneTabs: { ...state.paneTabs, [paneId]: path },
    }
  }),
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/thomas/Documents/huginn && npx vitest run src/stores/__tests__/editorStore.test.ts 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/stores/editorStore.ts src/stores/__tests__/editorStore.test.ts
git commit -m "feat: add setPaneActive action to editorStore"
```

---

### Task 2: Update `TabBar` to accept `paneId` and handle cross-pane drag

**Files:**
- Modify: `src/components/Editor/TabBar.tsx`

**Interfaces:**
- Consumes: `setPaneActive(paneId: string, path: string)` from `useEditorStore` (Task 1)
- Consumes: `paneTabs: Record<string, string | null>` from `useEditorStore` (already exists)
- Produces: `<TabBar paneId={string} />` — required prop

- [ ] **Step 1: Replace the full content of `TabBar.tsx`**

```tsx
import { useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { FileIcon } from '@/components/Sidebar/FileIcon'

export function TabBar({ paneId }: { paneId: string }) {
  const tabs = useEditorStore((s) => s.tabs)
  const paneTabs = useEditorStore((s) => s.paneTabs)
  const closeTab = useEditorStore((s) => s.closeTab)
  const moveTab = useEditorStore((s) => s.moveTab)
  const setPaneActive = useEditorStore((s) => s.setPaneActive)
  const activePath = paneTabs[paneId] ?? null

  const [draggedPath, setDraggedPath] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    path: string
    placement: 'before' | 'after'
  } | null>(null)

  if (tabs.length === 0) return null

  function getDropPlacement(e: React.DragEvent<HTMLElement>): 'before' | 'after' {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
  }

  function clearDragState() {
    setDraggedPath(null)
    setDropTarget(null)
  }

  return (
    <div className="flex bg-tab-bar border-b border-border overflow-x-auto shrink-0 select-none">
      {tabs.map((tab) => {
        const name = tab.path.split('/').pop() ?? tab.path
        const isActive = activePath === tab.path
        const isDragging = draggedPath === tab.path
        const isDropTarget = dropTarget?.path === tab.path && draggedPath !== tab.path
        return (
          <div
            key={tab.path}
            draggable
            className={`relative flex items-center gap-1.5 px-3 py-1.5 border-r border-border cursor-grab active:cursor-grabbing whitespace-nowrap text-sm ${
              isActive
                ? 'bg-panel text-fg border-t-2 border-t-accent -mt-px'
                : 'text-fg-muted hover:text-fg hover:bg-white/5'
            } ${isDragging ? 'opacity-45' : ''}`}
            onClick={() => setPaneActive(paneId, tab.path)}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', tab.path)
              e.dataTransfer.setData('application/x-huginn-pane', paneId)
              setDraggedPath(tab.path)
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('text/plain')) return
              if (draggedPath === tab.path) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDropTarget({ path: tab.path, placement: getDropPlacement(e) })
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setDropTarget((target) => (target?.path === tab.path ? null : target))
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              const sourcePath = e.dataTransfer.getData('text/plain')
              const sourcePaneId = e.dataTransfer.getData('application/x-huginn-pane')
              const placement =
                dropTarget?.path === tab.path ? dropTarget.placement : getDropPlacement(e)
              if (sourcePath && sourcePath !== tab.path) {
                if (sourcePaneId !== paneId) {
                  setPaneActive(paneId, sourcePath)
                } else {
                  moveTab(sourcePath, tab.path, placement)
                }
              }
              clearDragState()
            }}
            onDragEnd={clearDragState}
          >
            {isDropTarget && (
              <span
                className={[
                  'absolute top-1 bottom-1 w-0.5 rounded-full bg-accent',
                  dropTarget.placement === 'before' ? 'left-0' : 'right-0',
                ].join(' ')}
              />
            )}
            <FileIcon name={name} />
            <span>{name}</span>
            {tab.missing && (
              <span
                title="File no longer exists on disk. Press Cmd+S to save it again."
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-amber-400/70 text-[10px] font-bold leading-none text-amber-300"
              >
                !
              </span>
            )}
            {tab.dirty && (
              <span className="text-accent" title="Unsaved changes">
                ●
              </span>
            )}
            <button
              type="button"
              draggable={false}
              aria-label={`Close ${name}`}
              className="text-fg-subtle hover:text-fg text-base leading-none ml-1"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.path)
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
cd /Users/thomas/Documents/huginn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors referencing `TabBar.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/Editor/TabBar.tsx
git commit -m "feat: give TabBar a paneId prop with per-pane active and cross-pane drop"
```

---

### Task 3: Wire per-pane TabBar into EditorPane; remove top-level TabBar from Editor

**Files:**
- Modify: `src/components/Editor/Editor.tsx`

**Interfaces:**
- Consumes: `<TabBar paneId={string} />` (Task 2)

- [ ] **Step 1: Edit `Editor.tsx` — remove top-level `<TabBar />` and add flex-col wrapper + per-pane `<TabBar>` inside `EditorPane`**

Change the `Editor` function's return (remove `<TabBar />`):

Old:
```tsx
  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      <TabBar />
      {tabs.length > 0 ? (
        <div className="flex-1 min-h-0">
          <EditorLayout node={layout} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-fg-subtle text-sm">Open a file to start editing</p>
        </div>
      )}
    </div>
  )
```

New:
```tsx
  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      {tabs.length > 0 ? (
        <div className="flex-1 min-h-0">
          <EditorLayout node={layout} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-fg-subtle text-sm">Open a file to start editing</p>
        </div>
      )}
    </div>
  )
```

Change the `EditorPane` return to add flex-col and render `<TabBar paneId={paneId} />`:

Old:
```tsx
  return (
    <div
      className={[
        'h-full min-h-0 bg-panel overflow-hidden outline outline-1 -outline-offset-1',
        isActivePane ? 'outline-accent/50' : 'outline-transparent',
      ].join(' ')}
      onMouseDown={activatePane}
    >
      {activeTab ? (
```

New:
```tsx
  return (
    <div
      className={[
        'h-full min-h-0 flex flex-col bg-panel overflow-hidden outline outline-1 -outline-offset-1',
        isActivePane ? 'outline-accent/50' : 'outline-transparent',
      ].join(' ')}
      onMouseDown={activatePane}
    >
      <TabBar paneId={paneId} />
      <div className="flex-1 min-h-0 overflow-hidden">
      {activeTab ? (
```

And close the new wrapping div before the final `</div>` of `EditorPane`:

The `EditorPane` currently ends with:
```tsx
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-fg-subtle text-sm">Select a tab for this pane</p>
        </div>
      )}
    </div>
  )
```

Change to:
```tsx
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-fg-subtle text-sm">Select a tab for this pane</p>
        </div>
      )}
      </div>
    </div>
  )
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
cd /Users/thomas/Documents/huginn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/thomas/Documents/huginn && npx vitest run 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 4: Smoke-test in the running app**

- Open two files in the editor
- Press Cmd+D — verify the pane splits and BOTH panes show their own tab bar
- Click a different tab in the new pane — verify only that pane changes file
- Drag a tab within one pane's bar — verify reorder still works
- Drag a tab from one pane's bar into the other pane's bar — verify the target pane switches to that file
- Press Cmd+Shift+D — verify vertical split also gets its own tab bar

- [ ] **Step 5: Commit**

```bash
git add src/components/Editor/Editor.tsx
git commit -m "feat: render per-pane TabBar inside EditorPane, remove global TabBar"
```
