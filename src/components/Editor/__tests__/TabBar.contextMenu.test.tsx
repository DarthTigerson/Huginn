/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TabBar } from '../TabBar'
import { useEditorStore } from '@/stores/editorStore'
import { useTabContextMenuStore } from '@/stores/tabContextMenuStore'

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
