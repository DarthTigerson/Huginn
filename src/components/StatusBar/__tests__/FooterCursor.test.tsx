import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { FooterCursor } from '../FooterCursor'
import { useEditorCursorStore } from '@/stores/editorCursorStore'
import { useEditorStore } from '@/stores/editorStore'

const owner = {}

beforeEach(() => {
  useEditorCursorStore.setState({ cursor: null, owner: null })
  useEditorStore.setState({ activeTabPath: '/proj/src/App.tsx' })
})

afterEach(() => {
  cleanup()
})

describe('FooterCursor', () => {
  it('shows line and column for the active editor', () => {
    useEditorCursorStore.getState().publish(owner, { path: '/proj/src/App.tsx', line: 42, column: 8 })
    render(<FooterCursor />)
    expect(screen.getByTestId('footer-cursor').textContent).toBe('Ln 42, Col 8')
  })

  it('hides when the active tab is not the editor that published (e.g. a settings page)', () => {
    useEditorCursorStore.getState().publish(owner, { path: '/proj/src/App.tsx', line: 1, column: 1 })
    useEditorStore.setState({ activeTabPath: 'settings://Display' })
    render(<FooterCursor />)
    expect(screen.queryByTestId('footer-cursor')).toBeNull()
  })

  it('hides once the publishing editor releases it, but not when another one does', () => {
    useEditorCursorStore.getState().publish(owner, { path: '/proj/src/App.tsx', line: 3, column: 2 })
    render(<FooterCursor />)
    act(() => useEditorCursorStore.getState().release({}))
    expect(screen.getByTestId('footer-cursor')).toBeInTheDocument()
    act(() => useEditorCursorStore.getState().release(owner))
    expect(screen.queryByTestId('footer-cursor')).toBeNull()
  })
})
