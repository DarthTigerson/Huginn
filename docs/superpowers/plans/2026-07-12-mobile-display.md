# Mobile Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a smartphone icon to the left ActivityBar that toggles an empty "Mobile Display" side panel.

**Architecture:** Extend the existing `leftPanel` string union in `App.tsx` with `'mobile'`, export a new `PhoneIcon` from `ActivityBar.tsx`, create a minimal `MobileDisplayPanel` component, and wire them together in `App.tsx` following the identical pattern used by Files/Git/Todos/Settings.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + @testing-library/react

## Global Constraints

- Icon SVGs use `width="20" height="20"`, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth="1.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"` — match existing icons exactly.
- Panel shell must use `bg-sidebar border-r border-border` on the outer div, `h-9 px-3 border-b border-border` on the header row — match `TodoPanel` exactly.
- No new state management. No new stores. Only extend the existing `leftPanel` type.
- Test runner: `npm test` (vitest run).

---

### Task 1: Add `PhoneIcon` to ActivityBar

**Files:**
- Modify: `src/components/ActivityBar/ActivityBar.tsx`
- Test: `src/components/__tests__/PhoneIcon.test.tsx` (create)

**Interfaces:**
- Produces: `export function PhoneIcon(): JSX.Element` — zero props, same shape as `FilesIcon`, `GitIcon`, `TodoIcon`, etc.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/PhoneIcon.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PhoneIcon } from '@/components/ActivityBar/ActivityBar'

describe('PhoneIcon', () => {
  it('renders an svg', () => {
    const { container } = render(<PhoneIcon />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- PhoneIcon
```

Expected: FAIL — `PhoneIcon` is not exported from `ActivityBar`.

- [ ] **Step 3: Add `PhoneIcon` to `ActivityBar.tsx`**

Append after the closing brace of `SettingsIcon` (end of file):

```tsx
export function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10.5 5.5H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="18" r="1" fill="currentColor"/>
    </svg>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- PhoneIcon
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ActivityBar/ActivityBar.tsx src/components/__tests__/PhoneIcon.test.tsx
git commit -m "feat: add PhoneIcon to ActivityBar"
```

---

### Task 2: Create `MobileDisplayPanel`

**Files:**
- Create: `src/components/MobileDisplay/MobileDisplayPanel.tsx`
- Test: `src/components/__tests__/MobileDisplayPanel.test.tsx` (create)

**Interfaces:**
- Produces: `export function MobileDisplayPanel(): JSX.Element` — zero props.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/MobileDisplayPanel.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileDisplayPanel } from '@/components/MobileDisplay/MobileDisplayPanel'

describe('MobileDisplayPanel', () => {
  it('renders the panel header', () => {
    render(<MobileDisplayPanel />)
    expect(screen.getByText('Mobile Display')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- MobileDisplayPanel
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `src/components/MobileDisplay/MobileDisplayPanel.tsx`:

```tsx
export function MobileDisplayPanel() {
  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="h-9 px-3 border-b border-border shrink-0 flex items-center">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Mobile Display
        </span>
      </div>
      <div className="flex-1" />
    </div>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- MobileDisplayPanel
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MobileDisplay/MobileDisplayPanel.tsx src/components/__tests__/MobileDisplayPanel.test.tsx
git commit -m "feat: add MobileDisplayPanel placeholder"
```

---

### Task 3: Wire icon and panel into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `PhoneIcon` from `@/components/ActivityBar/ActivityBar` (Task 1), `MobileDisplayPanel` from `@/components/MobileDisplay/MobileDisplayPanel` (Task 2).

- [ ] **Step 1: Extend the `leftPanel` import and type in `App.tsx`**

In `src/App.tsx`, find the `PhoneIcon` import line (it's currently absent — add it to the existing ActivityBar import):

```tsx
// Before
import {
  ActivityBar,
  FilesIcon,
  GitIcon,
  TodoIcon,
  SettingsIcon,
  TerminalIcon,
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

// After
import {
  ActivityBar,
  FilesIcon,
  GitIcon,
  TodoIcon,
  PhoneIcon,
  SettingsIcon,
  TerminalIcon,
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

Add the `MobileDisplayPanel` import below the other panel imports:

```tsx
import { MobileDisplayPanel } from './components/MobileDisplay/MobileDisplayPanel'
```

- [ ] **Step 2: Extend the `leftPanel` state type**

```tsx
// Before
const [leftPanel, setLeftPanel] = useState<'files' | 'git' | 'todos' | 'settings' | null>('files')
const lastLeftPanelRef = useRef<'files' | 'git' | 'todos' | 'settings'>('files')

// After
const [leftPanel, setLeftPanel] = useState<'files' | 'git' | 'todos' | 'mobile' | 'settings' | null>('files')
const lastLeftPanelRef = useRef<'files' | 'git' | 'todos' | 'mobile' | 'settings'>('files')
```

- [ ] **Step 3: Add the icon to the left ActivityBar's top group**

In the `groups` prop of the left `<ActivityBar>`, add after the `todos` entry:

```tsx
{
  id: 'mobile',
  icon: <PhoneIcon />,
  title: 'Mobile Display',
  active: leftPanel === 'mobile',
  onClick: () => setLeftPanel((p) => (p === 'mobile' ? null : 'mobile')),
},
```

- [ ] **Step 4: Add the panel render branch**

Find the panel render expression (line ~308 in App.tsx):

```tsx
// Before
{leftPanel === 'files' ? <Sidebar /> : leftPanel === 'git' ? <GitPanel /> : leftPanel === 'todos' ? <TodoPanel /> : <SettingsPanel />}

// After
{leftPanel === 'files' ? <Sidebar /> : leftPanel === 'git' ? <GitPanel /> : leftPanel === 'todos' ? <TodoPanel /> : leftPanel === 'mobile' ? <MobileDisplayPanel /> : <SettingsPanel />}
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire mobile display icon and panel into App"
```
