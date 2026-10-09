import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { EditorContextMenu } from '../EditorContextMenu'

function fakeEditor() {
  const run = vi.fn()
  const getAction = vi.fn().mockReturnValue({ run })
  return { editor: { getAction } as any, run, getAction }
}

afterEach(() => {
  cleanup()
})

describe('EditorContextMenu', () => {
  it('always shows Change All Occurrences, with its ⌘F2 hint', () => {
    const { editor } = fakeEditor()
    render(<EditorContextMenu x={10} y={10} editor={editor} onClose={() => {}} />)
    expect(screen.getByText('Change All Occurrences')).toBeInTheDocument()
    // The exact hint text is platform-dependent (⌘F2 vs Ctrl+F2) - just
    // confirm it renders as a key chip, not bare unstyled text.
    const hint = screen.getByText(/F2$/).closest('kbd')
    expect(hint).not.toBeNull()
  })

  it('always shows Cut, Copy, and Paste', () => {
    const { editor } = fakeEditor()
    render(<EditorContextMenu x={10} y={10} editor={editor} onClose={() => {}} />)
    expect(screen.getByText('Cut')).toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
    expect(screen.getByText('Paste')).toBeInTheDocument()
  })

  it('no longer shows Command Palette (superseded by the Action Palette, which now includes editor commands)', () => {
    const { editor } = fakeEditor()
    render(<EditorContextMenu x={10} y={10} editor={editor} onClose={() => {}} />)
    expect(screen.queryByText('Command Palette')).not.toBeInTheDocument()
  })

  it('runs the matching Monaco action and closes on click', () => {
    const { editor, getAction, run } = fakeEditor()
    const onClose = vi.fn()
    render(<EditorContextMenu x={10} y={10} editor={editor} onClose={onClose} />)

    fireEvent.click(screen.getByText('Copy'))

    expect(getAction).toHaveBeenCalledWith('editor.action.clipboardCopyAction')
    expect(run).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape and on an outside click', () => {
    const { editor } = fakeEditor()
    const onClose = vi.fn()
    render(<EditorContextMenu x={10} y={10} editor={editor} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(window)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
