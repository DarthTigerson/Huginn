import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { EditorContextMenu } from '../EditorContextMenu'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'

function fakeEditor() {
  const run = vi.fn()
  const getAction = vi.fn().mockReturnValue({ run })
  return { editor: { getAction } as any, run, getAction }
}

beforeEach(() => {
  useEditorSettingsStore.setState({ changeAllOccurrencesInMenu: false })
})

afterEach(() => {
  cleanup()
})

describe('EditorContextMenu', () => {
  it('hides Change All Occurrences by default (setting off)', () => {
    const { editor } = fakeEditor()
    render(<EditorContextMenu x={10} y={10} editor={editor} onClose={() => {}} />)
    expect(screen.queryByText('Change All Occurrences')).not.toBeInTheDocument()
  })

  it('shows Change All Occurrences (with its ⌘F2 hint) once the setting is turned on', () => {
    useEditorSettingsStore.setState({ changeAllOccurrencesInMenu: true })
    const { editor } = fakeEditor()
    render(<EditorContextMenu x={10} y={10} editor={editor} onClose={() => {}} />)
    expect(screen.getByText('Change All Occurrences')).toBeInTheDocument()
  })

  it('always shows Cut, Copy, Paste, and Command Palette', () => {
    const { editor } = fakeEditor()
    render(<EditorContextMenu x={10} y={10} editor={editor} onClose={() => {}} />)
    expect(screen.getByText('Cut')).toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
    expect(screen.getByText('Paste')).toBeInTheDocument()
    expect(screen.getByText('Command Palette')).toBeInTheDocument()
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
