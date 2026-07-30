# Hold-to-Show Keyboard Shortcuts Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Holding Cmd alone for ~450ms brings up a centered overlay listing Huginn's custom keyboard shortcuts, grouped by category; releasing Cmd, pressing another key, pressing Escape, or losing window focus dismisses it.

**Architecture:** A static shortcut registry (`shortcuts.ts`) feeds a presentational overlay component (`ShortcutsOverlay.tsx`). A standalone hook (`useHoldToShowShortcuts`) owns all window-level keydown/keyup/blur listeners and a single timer, driving a boolean in `searchStore` (the existing home for the app's other overlay-open flags). `App.tsx` wires the hook and renders the overlay, following the exact pattern already used for `CommandPalette`/`ActionPalette`/`SearchModal`.

**Tech Stack:** React 18, Zustand, Vitest + @testing-library/react (fake timers), Tailwind.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-24-shortcuts-overlay-design.md`
- Hold delay is exactly 450ms.
- This is a macOS-only Electron app (`titleBarStyle: 'hiddenInset'`, `vibrancy: 'sidebar'` in `electron/main.ts`) — key caps are hardcoded as `⌘`/`⇧` symbols. No Ctrl-rendering / platform-detection branch (simplification vs. the spec's optional Windows/Linux note — YAGNI given the codebase targets Mac only).
- The hook never calls `preventDefault()` and never intercepts existing shortcut handlers — it only observes keydown/keyup/blur to drive overlay visibility.
- New test files go under `src/components/Shortcuts/__tests__/` — use the `.test.tsx` extension even for non-JSX test files so `vitest.config.ts`'s `environmentMatchGlobs` picks jsdom (needed for `renderHook`/`window.dispatchEvent`).
- Match existing modal visual conventions: `bg-sidebar border border-border rounded-xl shadow-2xl shadow-black/60`, backdrop `fixed inset-0 bg-black/60`, muted/subtle text via `text-fg-muted` / `text-fg-subtle`.

---

### Task 1: Shortcut Registry

**Files:**
- Create: `src/components/Shortcuts/shortcuts.ts`
- Test: `src/components/Shortcuts/__tests__/shortcuts.test.ts`

**Interfaces:**
- Produces: `ShortcutEntry { keys: string[]; label: string }`, `ShortcutGroup { category: string; items: ShortcutEntry[] }`, `SHORTCUT_GROUPS: ShortcutGroup[]` — all exported from `src/components/Shortcuts/shortcuts.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/Shortcuts/__tests__/shortcuts.test.ts
import { describe, it, expect } from 'vitest'
import { SHORTCUT_GROUPS } from '../shortcuts'

describe('SHORTCUT_GROUPS', () => {
  it('has the three expected categories in order', () => {
    expect(SHORTCUT_GROUPS.map((g) => g.category)).toEqual(['Navigation', 'Editor', 'Project'])
  })

  it('lists 10 shortcuts total, each with a label and at least one key', () => {
    const items = SHORTCUT_GROUPS.flatMap((g) => g.items)
    expect(items).toHaveLength(10)
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.keys.length).toBeGreaterThan(0)
    }
  })

  it('includes the sidebar toggle and action palette shortcuts', () => {
    const nav = SHORTCUT_GROUPS.find((g) => g.category === 'Navigation')!
    expect(nav.items).toContainEqual({ keys: ['⌘', 'B'], label: 'Toggle Sidebar' })
    expect(nav.items).toContainEqual({ keys: ['⌘', '⇧', 'P'], label: 'Action Palette' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Shortcuts/__tests__/shortcuts.test.ts`
Expected: FAIL — cannot find module `../shortcuts`

- [ ] **Step 3: Write the implementation**

```ts
// src/components/Shortcuts/shortcuts.ts
export interface ShortcutEntry {
  keys: string[]
  label: string
}

export interface ShortcutGroup {
  category: string
  items: ShortcutEntry[]
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: 'Navigation',
    items: [
      { keys: ['⌘', 'B'], label: 'Toggle Sidebar' },
      { keys: ['⌘', 'P'], label: 'Command Palette' },
      { keys: ['⌘', '⇧', 'P'], label: 'Action Palette' },
      { keys: ['⌘', 'F'], label: 'Search' },
      { keys: ['⌘', 'T'], label: 'New Terminal' },
    ],
  },
  {
    category: 'Editor',
    items: [
      { keys: ['⌘', 'S'], label: 'Save' },
      { keys: ['⌘', 'D'], label: 'Split Pane Horizontal' },
      { keys: ['⌘', '⇧', 'D'], label: 'Split Pane Vertical' },
    ],
  },
  {
    category: 'Project',
    items: [
      { keys: ['⌘', 'W'], label: 'Close Tab' },
      { keys: ['⌘', '⇧', 'O'], label: 'Open Project' },
    ],
  },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Shortcuts/__tests__/shortcuts.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/Shortcuts/shortcuts.ts src/components/Shortcuts/__tests__/shortcuts.test.ts
git commit -m "feat: add keyboard shortcuts registry data"
```

---

### Task 2: `searchStore` Overlay State

**Files:**
- Modify: `src/stores/searchStore.ts`
- Test: `src/stores/__tests__/searchStore.test.ts` (new file)

**Interfaces:**
- Produces: `useSearchStore` gains `shortcutsOverlayOpen: boolean`, `openShortcutsOverlay(): void`, `closeShortcutsOverlay(): void`.

- [ ] **Step 1: Write the failing test**

```ts
// src/stores/__tests__/searchStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSearchStore } from '../searchStore'

describe('searchStore shortcuts overlay', () => {
  beforeEach(() => useSearchStore.setState({ shortcutsOverlayOpen: false }))

  it('starts closed', () => {
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('openShortcutsOverlay sets it true', () => {
    useSearchStore.getState().openShortcutsOverlay()
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)
  })

  it('closeShortcutsOverlay sets it false', () => {
    useSearchStore.setState({ shortcutsOverlayOpen: true })
    useSearchStore.getState().closeShortcutsOverlay()
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/__tests__/searchStore.test.ts`
Expected: FAIL — `openShortcutsOverlay is not a function` (property doesn't exist yet)

- [ ] **Step 3: Write the implementation**

```ts
// src/stores/searchStore.ts
import { create } from 'zustand'

interface SearchState {
  commandPaletteOpen: boolean
  searchOpen: boolean
  searchCaseSensitive: boolean
  actionPaletteOpen: boolean
  shortcutsOverlayOpen: boolean
  openCommandPalette: () => void
  closeCommandPalette: () => void
  openSearch: (caseSensitive: boolean) => void
  closeSearch: () => void
  openActionPalette: () => void
  closeActionPalette: () => void
  openShortcutsOverlay: () => void
  closeShortcutsOverlay: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  commandPaletteOpen: false,
  searchOpen: false,
  searchCaseSensitive: false,
  actionPaletteOpen: false,
  shortcutsOverlayOpen: false,
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  openSearch: (caseSensitive) => set({ searchOpen: true, searchCaseSensitive: caseSensitive }),
  closeSearch: () => set({ searchOpen: false }),
  openActionPalette: () => set({ actionPaletteOpen: true }),
  closeActionPalette: () => set({ actionPaletteOpen: false }),
  openShortcutsOverlay: () => set({ shortcutsOverlayOpen: true }),
  closeShortcutsOverlay: () => set({ shortcutsOverlayOpen: false }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stores/__tests__/searchStore.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stores/searchStore.ts src/stores/__tests__/searchStore.test.ts
git commit -m "feat: add shortcuts overlay state to searchStore"
```

---

### Task 3: `useHoldToShowShortcuts` Hook

**Files:**
- Create: `src/components/Shortcuts/useHoldToShowShortcuts.ts`
- Test: `src/components/Shortcuts/__tests__/useHoldToShowShortcuts.test.tsx`

**Interfaces:**
- Consumes: `useSearchStore` from `@/stores/searchStore` — fields `commandPaletteOpen`, `searchOpen`, `actionPaletteOpen`, `shortcutsOverlayOpen`; actions `openShortcutsOverlay()`, `closeShortcutsOverlay()` (Task 2).
- Produces: `useHoldToShowShortcuts(): void` — a hook with no params/return, called once from `App.tsx` (Task 5).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/Shortcuts/__tests__/useHoldToShowShortcuts.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useHoldToShowShortcuts } from '../useHoldToShowShortcuts'
import { useSearchStore } from '@/stores/searchStore'

function keydown(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, metaKey: true, bubbles: true }))
}

function keyup(key: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key, metaKey: false, bubbles: true }))
}

describe('useHoldToShowShortcuts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useSearchStore.setState({
      commandPaletteOpen: false,
      searchOpen: false,
      searchCaseSensitive: false,
      actionPaletteOpen: false,
      shortcutsOverlayOpen: false,
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('opens the overlay after holding Meta alone for 450ms', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })

    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)
  })

  it('does not open if a non-modifier key is pressed before the delay elapses', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(200)
      keydown('t')
      vi.advanceTimersByTime(450)
    })

    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('closes the overlay when a non-modifier key is pressed while open', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)

    act(() => {
      keydown('t')
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('closes the overlay when Escape is pressed while open', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)

    act(() => {
      keydown('Escape')
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('closes the overlay on Meta keyup', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)

    act(() => {
      keyup('Meta')
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('closes the overlay on window blur', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('does not open while the command palette is already open', () => {
    useSearchStore.setState({ commandPaletteOpen: true })
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })

    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Shortcuts/__tests__/useHoldToShowShortcuts.test.tsx`
Expected: FAIL — cannot find module `../useHoldToShowShortcuts`

- [ ] **Step 3: Write the implementation**

```ts
// src/components/Shortcuts/useHoldToShowShortcuts.ts
import { useEffect, useRef } from 'react'
import { useSearchStore } from '@/stores/searchStore'

const HOLD_DELAY_MS = 450
const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Shift', 'Alt'])

export function useHoldToShowShortcuts() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    function closeIfOpen() {
      if (useSearchStore.getState().shortcutsOverlayOpen) {
        useSearchStore.getState().closeShortcutsOverlay()
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return

      if (MODIFIER_KEYS.has(e.key)) {
        if (timerRef.current === null) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            const { commandPaletteOpen, searchOpen, actionPaletteOpen, openShortcutsOverlay } =
              useSearchStore.getState()
            if (!commandPaletteOpen && !searchOpen && !actionPaletteOpen) {
              openShortcutsOverlay()
            }
          }, HOLD_DELAY_MS)
        }
        return
      }

      clearTimer()
      closeIfOpen()
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Meta' || e.key === 'Control') {
        clearTimer()
        closeIfOpen()
      }
    }

    function onBlur() {
      clearTimer()
      closeIfOpen()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      clearTimer()
    }
  }, [])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Shortcuts/__tests__/useHoldToShowShortcuts.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/Shortcuts/useHoldToShowShortcuts.ts src/components/Shortcuts/__tests__/useHoldToShowShortcuts.test.tsx
git commit -m "feat: add hold-to-show timer/listener hook for shortcuts overlay"
```

---

### Task 4: `ShortcutsOverlay` Component

**Files:**
- Create: `src/components/Shortcuts/ShortcutsOverlay.tsx`
- Test: `src/components/Shortcuts/__tests__/ShortcutsOverlay.test.tsx`

**Interfaces:**
- Consumes: `SHORTCUT_GROUPS` from `./shortcuts` (Task 1).
- Produces: `ShortcutsOverlay` — a no-props component, rendered conditionally by `App.tsx` (Task 5).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/Shortcuts/__tests__/ShortcutsOverlay.test.tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ShortcutsOverlay } from '../ShortcutsOverlay'

afterEach(() => cleanup())

describe('ShortcutsOverlay', () => {
  it('renders every category and shortcut label', () => {
    render(<ShortcutsOverlay />)

    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument()
    expect(screen.getByText('Split Pane Vertical')).toBeInTheDocument()
    expect(screen.getByText('Open Project')).toBeInTheDocument()
  })

  it('renders one key cap per shortcut key, including shift symbols', () => {
    render(<ShortcutsOverlay />)

    expect(screen.getAllByText('⌘')).toHaveLength(10)
    expect(screen.getAllByText('⇧').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Shortcuts/__tests__/ShortcutsOverlay.test.tsx`
Expected: FAIL — cannot find module `../ShortcutsOverlay`

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/Shortcuts/ShortcutsOverlay.tsx
import { SHORTCUT_GROUPS } from './shortcuts'

export function ShortcutsOverlay() {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
      <div className="w-[420px] max-h-[70vh] overflow-y-auto flex flex-col gap-5 bg-sidebar border border-border rounded-xl shadow-2xl shadow-black/60 p-5">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.category}>
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-2">
              {group.category}
            </div>
            <div className="flex flex-col gap-1.5">
              {group.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-fg-muted">{item.label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {item.keys.map((key, i) => (
                      <kbd
                        key={i}
                        className="min-w-[22px] px-1.5 py-0.5 text-xs text-center font-medium text-fg bg-panel border border-border rounded"
                      >
                        {key}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Shortcuts/__tests__/ShortcutsOverlay.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/Shortcuts/ShortcutsOverlay.tsx src/components/Shortcuts/__tests__/ShortcutsOverlay.test.tsx
git commit -m "feat: add ShortcutsOverlay component"
```

---

### Task 5: Wire Into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useHoldToShowShortcuts` (Task 3), `ShortcutsOverlay` (Task 4), `useSearchStore().shortcutsOverlayOpen` (Task 2).
- No new exports — this task wires existing pieces into the running app. No automated test exists for `App.tsx` today (no `App.test.tsx` in the repo), so this task is verified manually (Step 4).

- [ ] **Step 1: Add imports**

In `src/App.tsx`, add alongside the existing component imports (near `import { ActionPalette } from './components/Search/ActionPalette'`):

```ts
import { ShortcutsOverlay } from './components/Shortcuts/ShortcutsOverlay'
import { useHoldToShowShortcuts } from './components/Shortcuts/useHoldToShowShortcuts'
```

- [ ] **Step 2: Read the store flag and call the hook**

In the `App()` function body, alongside the other `useSearchStore` selectors (near `const actionPaletteOpen = useSearchStore((s) => s.actionPaletteOpen)` at `src/App.tsx:89`):

```ts
  const shortcutsOverlayOpen = useSearchStore((s) => s.shortcutsOverlayOpen)
```

Then, alongside the existing top-level `useEffect` calls (e.g. right after the `useEffect(() => { useFileStore.getState().restoreRoot() }, [])` block at `src/App.tsx:171-173`):

```ts
  useHoldToShowShortcuts()
```

- [ ] **Step 3: Render the overlay**

In the JSX, alongside the other conditionally-rendered overlays at the end of the component (`src/App.tsx:430-432`, right after the `actionPaletteOpen && <ActionPalette .../>` block):

```tsx
      {shortcutsOverlayOpen && <ShortcutsOverlay />}
```

- [ ] **Step 4: Manually verify in the running app**

Run: `npm run dev`

In the launched app window:
1. Hold Cmd alone (don't press any other key) for about half a second — the shortcuts panel should fade in, centered, showing Navigation/Editor/Project groups.
2. Release Cmd — the panel should disappear immediately.
3. Hold Cmd, then quickly press `B` before the panel appears — the sidebar should toggle and the panel should never flash on screen.
4. Hold Cmd until the panel appears, then press `T` — a new terminal tab should open and the panel should close.
5. Hold Cmd until the panel appears, then Cmd+Tab away to another app — switch back and confirm the panel is closed.
6. Open the Command Palette (Cmd+P), then, while it's still open, hold Cmd alone — the shortcuts panel should NOT appear on top of it.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new ones from Tasks 1–4.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire hold-to-show shortcuts overlay into App"
```
