/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TabBar } from '../TabBar'
import { useEditorStore } from '@/stores/editorStore'

const LONG_NAME_PATH = '/project/src/components/a-very-long-component-name.tsx'

function setup() {
  useEditorStore.setState({
    tabs: [
      { path: '/project/src/a.ts', content: '', dirty: false },
      { path: LONG_NAME_PATH, content: '', dirty: false },
    ],
    activeTabPath: '/project/src/a.ts',
    layout: { type: 'pane', id: 'pane-1' },
    activePaneId: 'pane-1',
    paneTabs: { 'pane-1': '/project/src/a.ts' },
    paneTabLists: { 'pane-1': ['/project/src/a.ts', LONG_NAME_PATH] },
    closedTabs: [],
    pinnedPaths: new Set([LONG_NAME_PATH]),
  })
}

afterEach(() => cleanup())

describe('TabBar — pinned tabs', () => {
  it('renders the pinned tab first even though it comes second in the pane list', () => {
    setup()
    render(<TabBar paneId="pane-1" />)
    const tabLabels = screen.getAllByText(/\.ts$|…$/).map((el) => el.textContent)
    expect(tabLabels[0]).toBe('a-very-long-com…')
    expect(tabLabels[1]).toBe('a.ts')
  })

  it('truncates the pinned tab label to 15 characters plus an ellipsis', () => {
    setup()
    render(<TabBar paneId="pane-1" />)
    expect(screen.getByText('a-very-long-com…')).toBeInTheDocument()
    expect(screen.queryByText('a-very-long-component-name.tsx')).not.toBeInTheDocument()
  })

  it('does not truncate an unpinned tab even if its name is long', () => {
    useEditorStore.setState({
      tabs: [{ path: LONG_NAME_PATH, content: '', dirty: false }],
      activeTabPath: LONG_NAME_PATH,
      layout: { type: 'pane', id: 'pane-1' },
      activePaneId: 'pane-1',
      paneTabs: { 'pane-1': LONG_NAME_PATH },
      paneTabLists: { 'pane-1': [LONG_NAME_PATH] },
      closedTabs: [],
      pinnedPaths: new Set(),
    })
    render(<TabBar paneId="pane-1" />)
    expect(screen.getByText('a-very-long-component-name.tsx')).toBeInTheDocument()
  })
})
