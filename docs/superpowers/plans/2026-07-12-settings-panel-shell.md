# Settings Panel Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings button to the left activity bar that opens a Settings panel (closing the file tree if it's open), with one "Themes" row that opens a placeholder tab in the existing editor tab strip.

**Architecture:** Replace the boolean `sidebarVisible` state in `App.tsx` with a tri-state `leftPanel: 'files' | 'settings' | null`, so Explorer and Settings share one mutually-exclusive slot. `SettingsPanel` is a new component parallel to `Sidebar`. Clicking its "Themes" row opens a virtual tab (`settings://Themes`) via the existing `editorStore`; `Editor.tsx` recognizes that path and renders a placeholder instead of Monaco.

**Tech Stack:** React 18 + TypeScript, Zustand (`editorStore`), Tailwind, existing `ActivityBar`/`Panel` (react-resizable-panels) components. No new dependencies.

## Global Constraints

- No new unit tests beyond what exists — this repo has no React component test harness (no jsdom/RTL installed), only Vitest+node-env store tests. Verify this feature by typechecking + manually running the app (per spec's Testing section).
- Theme store, CSS variables, markdown rendering, and real theme switching are **out of scope** for this plan (see spec's "Explicitly out of scope" section) — do not build any of that here.
- Typecheck command: `npx tsc --noEmit -p tsconfig.web.json` (NOT `tsc --build`, which emits `.js`/`.d.ts` files in-place next to sources and shadows them for Vite/Vitest — a known footgun in this repo). If any stale `.js`/`.d.ts` files ever appear next to `.ts`/`.tsx` sources in `electron/` or `src/`, delete them (they're gitignored build cruft, see `.gitignore`'s "TypeScript composite build artifacts" comment).

---

### Task 1: Add SettingsIcon to ActivityBar

**Files:**
- Modify: `src/components/ActivityBar/ActivityBar.tsx`

**Interfaces:**
- Produces: `export function SettingsIcon()` — a React component rendering a gear SVG, same call signature/style as the existing `FilesIcon()`, `ClaudeIcon()`, etc. (no props, returns JSX).

- [ ] **Step 1: Add the icon export**

Add this new export at the end of `src/components/ActivityBar/ActivityBar.tsx` (after the existing `FastIcon` function, i.e. after line 198):

```tsx
export function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/ActivityBar/ActivityBar.tsx
git commit -m "feat: add SettingsIcon to ActivityBar"
```

---

### Task 2: Settings tab path helper + SettingsPanel component

**Files:**
- Create: `src/components/Settings/paths.ts`
- Create: `src/components/Settings/SettingsPanel.tsx`

**Interfaces:**
- Consumes: `useEditorStore` from `@/stores/editorStore` — specifically `useEditorStore.getState().openTab(tab: { path: string; content: string; dirty: boolean })` (existing, defined in `src/stores/editorStore.ts:17-24`).
- Produces:
  - `export const THEMES_TAB_PATH = 'settings://Themes'` from `paths.ts`
  - `export function isSettingsTab(path: string): boolean` from `paths.ts` — later consumed by Task 3 (`Editor.tsx`)
  - `export function SettingsPanel()` from `SettingsPanel.tsx` — consumed by Task 4 (`App.tsx`)

- [ ] **Step 1: Create the shared path helper**

Create `src/components/Settings/paths.ts`:

```ts
export const THEMES_TAB_PATH = 'settings://Themes'

export function isSettingsTab(path: string): boolean {
  return path.startsWith('settings://')
}
```

- [ ] **Step 2: Create SettingsPanel**

Create `src/components/Settings/SettingsPanel.tsx`:

```tsx
import { useEditorStore } from '@/stores/editorStore'
import { THEMES_TAB_PATH } from './paths'

export function SettingsPanel() {
  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">
          Settings
        </span>
      </div>
      <div className="flex-1 overflow-auto py-1">
        <button
          type="button"
          onClick={() =>
            useEditorStore.getState().openTab({ path: THEMES_TAB_PATH, content: '', dirty: false })
          }
          className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          Themes
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/Settings/paths.ts src/components/Settings/SettingsPanel.tsx
git commit -m "feat: add SettingsPanel component"
```

---

### Task 3: Editor renders a placeholder for virtual settings tabs

**Files:**
- Modify: `src/components/Editor/Editor.tsx`

**Interfaces:**
- Consumes: `isSettingsTab` from `@/components/Settings/paths` (produced in Task 2).
- Produces: no new exports — `Editor` component's external interface (props: none) is unchanged.

- [ ] **Step 1: Guard the Cmd+S handler and render the placeholder**

Replace the full contents of `src/components/Editor/Editor.tsx` with:

```tsx
import { useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useEditorStore } from '@/stores/editorStore'
import { TabBar } from './TabBar'
import { detectLang } from './utils'
import { isSettingsTab } from '@/components/Settings/paths'

export function Editor() {
  const { tabs, activeTabPath, updateContent } = useEditorStore()
  const activeTab = tabs.find((t) => t.path === activeTabPath)
  const isVirtual = !!activeTab && isSettingsTab(activeTab.path)

  useEffect(() => {
    if (!activeTab || isVirtual) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        window.api.writeFile(activeTab.path, activeTab.content)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab, isVirtual])

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      <TabBar />
      {activeTab ? (
        isVirtual ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-600 text-sm">Themes — coming soon</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              key={activeTab.path}
              value={activeTab.content}
              language={detectLang(activeTab.path)}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                padding: { top: 8 },
                automaticLayout: true,
              }}
              onChange={(val) => updateContent(activeTab.path, val ?? '')}
            />
          </div>
        )
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-sm">Open a file to start editing</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/Editor/Editor.tsx
git commit -m "feat: render placeholder for virtual settings tabs in Editor"
```

---

### Task 4: Wire the Settings button into App.tsx

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes:
  - `SettingsIcon` from `@/components/ActivityBar/ActivityBar` (Task 1)
  - `SettingsPanel` from `@/components/Settings/SettingsPanel` (Task 2)
- Produces: no new exports — this is the final integration task.

- [ ] **Step 1: Import the new pieces**

In `src/App.tsx`, update the `ActivityBar` import (currently lines 7-19) to add `SettingsIcon`:

```tsx
import {
  ActivityBar,
  FilesIcon,
  SettingsIcon,
  ClaudeIcon,
  CodexIcon,
  NewSessionIcon,
  PreviousSessionIcon,
  CompactIcon,
  ClearIcon,
  UsageIcon,
  ModelIcon,
  FastIcon,
} from './components/ActivityBar/ActivityBar'
```

Add a new import right after it:

```tsx
import { SettingsPanel } from './components/Settings/SettingsPanel'
```

- [ ] **Step 2: Replace `sidebarVisible` with `leftPanel`**

Find this line (currently line 36):

```tsx
  const [sidebarVisible, setSidebarVisible] = useState(true)
```

Replace it with:

```tsx
  const [leftPanel, setLeftPanel] = useState<'files' | 'settings' | null>('files')
```

- [ ] **Step 3: Update the left ActivityBar**

Find the left `ActivityBar` block (currently lines 140-149):

```tsx
        <ActivityBar
          side="left"
          groups={[[{
            id: 'files',
            icon: <FilesIcon />,
            title: 'Explorer',
            active: sidebarVisible,
            onClick: () => setSidebarVisible((v) => !v),
          }]]}
        />
```

Replace it with:

```tsx
        <ActivityBar
          side="left"
          groups={[[{
            id: 'files',
            icon: <FilesIcon />,
            title: 'Explorer',
            active: leftPanel === 'files',
            onClick: () => setLeftPanel((p) => (p === 'files' ? null : 'files')),
          }]]}
          bottomGroups={[[{
            id: 'settings',
            icon: <SettingsIcon />,
            title: 'Settings',
            active: leftPanel === 'settings',
            onClick: () => setLeftPanel((p) => (p === 'settings' ? null : 'settings')),
          }]]}
        />
```

- [ ] **Step 4: Render SettingsPanel in the sidebar slot**

Find this block (currently lines 151-158):

```tsx
          {sidebarVisible && (
            <>
              <Panel defaultSize={20} minSize={12} maxSize={40} id="sidebar" order={1}>
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-px bg-border hover:bg-accent/60 transition-colors cursor-col-resize" />
            </>
          )}
```

Replace it with:

```tsx
          {leftPanel && (
            <>
              <Panel defaultSize={20} minSize={12} maxSize={40} id="sidebar" order={1}>
                {leftPanel === 'files' ? <Sidebar /> : <SettingsPanel />}
              </Panel>
              <PanelResizeHandle className="w-px bg-border hover:bg-accent/60 transition-colors cursor-col-resize" />
            </>
          )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: no output, exit code 0.

- [ ] **Step 6: Full test suite (regression check)**

Run: `npm test`
Expected: same baseline as before this change — `electron/__tests__/claude.test.ts` (2 tests) and the other store tests pass; only the pre-existing unrelated `fileStore.test.ts > openFolder sets root and loads tree` failure remains (known issue on `main`, not introduced by this work).

- [ ] **Step 7: Manual verification**

Run: `npm run dev`

In the launched app:
1. Confirm the file tree (Explorer) is visible by default and a gear icon now appears at the bottom of the left activity bar.
2. Click the gear icon. Confirm the file tree disappears and a "Settings" panel appears with one "Themes" row.
3. Click "Themes". Confirm a new tab labeled "Themes" opens in the editor tab strip (alongside any other open file tabs) showing "Themes — coming soon".
4. Press Cmd+S while that tab is active. Confirm nothing happens (no error, no file write).
5. Click the Explorer (folder) icon. Confirm the Settings panel closes and the file tree reopens.
6. Click the gear icon again, then click the folder icon. Confirm each click closes whichever of the two panels was open and opens the other (never both at once).

If any of these fail, stop and fix before committing.

- [ ] **Step 8: Clean up any stale build artifacts**

Run: `find electron src -type f \( -name "*.js" -o -name "*.d.ts" \) -not -path "*/__tests__/*.test.*"` and delete (with `rm`) any result that shadows a same-named `.ts`/`.tsx` file (per the Global Constraints note above). This should normally print nothing if only `tsc --noEmit` was used throughout.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add Settings button and wire it into the left panel"
```
