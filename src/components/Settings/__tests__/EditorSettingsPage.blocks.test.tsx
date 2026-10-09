/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'

vi.mock('@/stores/lspStatusStore', () => ({
  useLspStatusStore: (sel: (s: { refresh: () => void }) => unknown) => sel({ refresh: () => {} }),
  subscribeLspInstallEvents: () => {},
}))
vi.mock('../LspServerRow', () => ({ LspServerRow: ({ id }: { id: string }) => <div>lsp:{id}</div> }))

import { EditorSettingsPage } from '../EditorSettingsPage'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'

beforeEach(() => {
  useEditorSettingsStore.setState({ autoSaveEnabled: false, wordWrapEnabled: false, changeAllOccurrencesInMenu: false, markdownOpenMode: 'editor' })
})
afterEach(cleanup)

describe('EditorSettingsPage — feature blocks', () => {
  it('lays the page out as five blocks', () => {
    render(<EditorSettingsPage />)
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Auto save', 'Word wrap', 'Right-click menu', 'Markdown files', 'Go to definition',
    ])
  })

  it('previews auto save: an unsaved dot while off, none while on', () => {
    const { rerender } = render(<EditorSettingsPage />)
    expect(screen.getByTestId('autosave-dirty-dot')).toBeInTheDocument()
    useEditorSettingsStore.setState({ autoSaveEnabled: true })
    rerender(<EditorSettingsPage />)
    expect(screen.queryByTestId('autosave-dirty-dot')).toBeNull()
  })

  it('previews word wrap and the markdown mode', () => {
    const { rerender } = render(<EditorSettingsPage />)
    expect(screen.getByTestId('word-wrap-preview').querySelector('[data-wrap]')).toHaveAttribute('data-wrap', 'false')
    expect(screen.getByTestId('markdown-preview').querySelector('[data-mode]')).toHaveAttribute('data-mode', 'editor')
    useEditorSettingsStore.setState({ wordWrapEnabled: true, markdownOpenMode: 'split' })
    rerender(<EditorSettingsPage />)
    expect(screen.getByTestId('word-wrap-preview').querySelector('[data-wrap]')).toHaveAttribute('data-wrap', 'true')
    expect(screen.getByTestId('markdown-preview').querySelector('[data-mode]')).toHaveAttribute('data-mode', 'split')
  })

  it('shows Change All Occurrences in the previewed menu only when it is turned on', () => {
    const { rerender } = render(<EditorSettingsPage />)
    expect(within(screen.getByTestId('context-menu-preview')).queryByText('Change All Occurrences')).toBeNull()
    useEditorSettingsStore.setState({ changeAllOccurrencesInMenu: true })
    rerender(<EditorSettingsPage />)
    expect(within(screen.getByTestId('context-menu-preview')).getByText('Change All Occurrences')).toBeInTheDocument()
  })

  it('still lists every language server', () => {
    render(<EditorSettingsPage />)
    expect(within(screen.getByRole('region', { name: 'Go to definition' })).getAllByText(/^lsp:/).length).toBeGreaterThan(0)
  })
})
