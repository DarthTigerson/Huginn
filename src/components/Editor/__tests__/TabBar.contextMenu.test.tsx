/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { TabBar } from '../TabBar'
import { useEditorStore } from '@/stores/editorStore'
import { useTabContextMenuStore } from '@/stores/tabContextMenuStore'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'

// The tab menu checks the tab's file exists before offering the reveal actions.
beforeEach(() => {
  ;(global as any).window.api = { ...(global as any).window.api, pathExists: vi.fn().mockResolvedValue(true) }
})

afterEach(() => {
  cleanup()
  useTabContextMenuStore.setState({ open: null })
})

function setupTwoPanes() {
  useEditorStore.setState({
    tabs: [
      { path: '/pane1-tab.ts', content: '', dirty: false },
      { path: '/pane2-tab.ts', content: '', dirty: false },
    ],
    activeTabPath: '/pane1-tab.ts',
    layout: {
      type: 'split',
      direction: 'horizontal',
      children: [
        { type: 'pane', id: 'pane-1' },
        { type: 'pane', id: 'pane-2' },
      ],
    },
    activePaneId: 'pane-1',
    paneTabs: { 'pane-1': '/pane1-tab.ts', 'pane-2': '/pane2-tab.ts' },
    paneTabLists: { 'pane-1': ['/pane1-tab.ts'], 'pane-2': ['/pane2-tab.ts'] },
    closedTabs: [],
    pinnedPaths: new Set(),
  })
}

// Reported bug: right-clicking a tab in one pane while a context menu from
// another pane is already open left BOTH menus on screen, because each
// TabBar instance (one per pane) kept its own local menu state.
describe('TabBar — context menu across panes', () => {
  it('right-clicking a tab in a second pane closes the menu already open in the first', () => {
    setupTwoPanes()
    render(
      <>
        <TabBar paneId="pane-1" />
        <TabBar paneId="pane-2" />
      </>
    )

    fireEvent.contextMenu(screen.getByText('pane1-tab.ts'))
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1)

    fireEvent.contextMenu(screen.getByText('pane2-tab.ts'))
    // Only one Close button should exist anywhere - the second pane's menu,
    // not both.
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1)
  })
})

describe('TabBar — inline diff toggle', () => {
  it('shows the current state on a file tab and flips the global setting', () => {
    setupTwoPanes()
    useEditorSettingsStore.setState({ inlineDiffEnabled: true })
    render(<TabBar paneId="pane-1" />)

    fireEvent.contextMenu(screen.getByText('pane1-tab.ts'))
    fireEvent.click(screen.getByRole('button', { name: 'Hide Inline Diff' }))
    expect(useEditorSettingsStore.getState().inlineDiffEnabled).toBe(false)

    fireEvent.contextMenu(screen.getByText('pane1-tab.ts'))
    expect(screen.getByRole('button', { name: 'Show Inline Diff' })).toBeInTheDocument()
  })

  it('is not offered on non-file tabs', () => {
    setupTwoPanes()
    render(<TabBar paneId="pane-1" />)
    act(() => useTabContextMenuStore.getState().openMenu('pane-1', 'settings://Git', 0, 0))
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Inline Diff/ })).toBeNull()
  })
})
