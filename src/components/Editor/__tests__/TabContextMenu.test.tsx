/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TabContextMenu } from '../TabContextMenu'
import { useEditorStore } from '@/stores/editorStore'
import { useBrowserStore } from '@/stores/browserStore'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'
import { buildBrowserPath } from '@/components/Settings/paths'

function resetStores() {
  useEditorStore.setState({
    tabs: [
      { path: '/a.ts', content: '', dirty: false },
      { path: '/b.ts', content: '', dirty: false },
    ],
    activeTabPath: '/a.ts',
    layout: { type: 'pane', id: 'pane-1' },
    activePaneId: 'pane-1',
    paneTabs: { 'pane-1': '/a.ts' },
    paneTabLists: { 'pane-1': ['/a.ts', '/b.ts'] },
    closedTabs: [],
    pinnedPaths: new Set(),
  })
  useEditorSettingsStore.setState({ autoSaveEnabled: false })
  useBrowserStore.setState({ tabs: {} })
}

afterEach(() => {
  cleanup()
})

describe('TabContextMenu — file tab', () => {
  it('shows the common actions and Copy File Path, not Reload/Duplicate', () => {
    resetStores()
    render(<TabContextMenu x={10} y={10} paneId="pane-1" path="/a.ts" onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy File Path' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument()
  })

  it('shows Close All Saved when autosave is off, hides it when autosave is on', () => {
    resetStores()
    const { rerender } = render(<TabContextMenu x={10} y={10} paneId="pane-1" path="/a.ts" onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Close All Saved' })).toBeInTheDocument()

    useEditorSettingsStore.setState({ autoSaveEnabled: true })
    rerender(<TabContextMenu x={10} y={10} paneId="pane-1" path="/a.ts" onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Close All Saved' })).not.toBeInTheDocument()
  })

  it('shows "Pin Tab" for an unpinned tab and "Unpin Tab" once pinned', () => {
    resetStores()
    render(<TabContextMenu x={10} y={10} paneId="pane-1" path="/a.ts" onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Pin Tab' })).toBeInTheDocument()

    useEditorStore.getState().togglePin('/a.ts')
    cleanup()
    render(<TabContextMenu x={10} y={10} paneId="pane-1" path="/a.ts" onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Unpin Tab' })).toBeInTheDocument()
  })

  it('disables the Split trigger when the pane has only this one tab (nothing to leave behind)', () => {
    useEditorStore.setState({
      tabs: [{ path: '/a.ts', content: '', dirty: false }],
      activeTabPath: '/a.ts',
      layout: { type: 'pane', id: 'pane-1' },
      activePaneId: 'pane-1',
      paneTabs: { 'pane-1': '/a.ts' },
      paneTabLists: { 'pane-1': ['/a.ts'] },
      closedTabs: [],
      pinnedPaths: new Set(),
    })
    useEditorSettingsStore.setState({ autoSaveEnabled: false })
    render(<TabContextMenu x={10} y={10} paneId="pane-1" path="/a.ts" onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Split' })).toBeDisabled()
  })

  it('hides Move entirely when the pane has no neighbors', () => {
    resetStores()
    render(<TabContextMenu x={10} y={10} paneId="pane-1" path="/a.ts" onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument()
  })

  it('shows Move once a neighboring pane exists', () => {
    resetStores()
    useEditorStore.getState().splitPaneForTab('pane-1', '/b.ts', 'horizontal', 'after')
    render(<TabContextMenu x={10} y={10} paneId="pane-1" path="/a.ts" onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument()
  })

  it('calls closeTabInPane with the right pane and path when Close is clicked', () => {
    resetStores()
    const onClose = vi.fn()
    render(<TabContextMenu x={10} y={10} paneId="pane-1" path="/a.ts" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(useEditorStore.getState().tabs.map((t) => t.path)).toEqual(['/b.ts'])
    expect(onClose).toHaveBeenCalled()
  })
})

describe('TabContextMenu — browser tab', () => {
  it('shows Reload and Duplicate, not Copy File Path', () => {
    resetStores()
    const browserPath = buildBrowserPath('browser-1')
    useEditorStore.setState({
      tabs: [{ path: browserPath, content: '', dirty: false }],
      activeTabPath: browserPath,
      paneTabs: { 'pane-1': browserPath },
      paneTabLists: { 'pane-1': [browserPath] },
    })
    useBrowserStore.getState().ensureTab('browser-1', 'https://example.com')

    render(<TabContextMenu x={10} y={10} paneId="pane-1" path={browserPath} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy File Path' })).not.toBeInTheDocument()
  })
})
