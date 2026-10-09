/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { GitSettingsPage } from '../GitSettingsPage'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'
import { useFileStore } from '@/stores/fileStore'

beforeEach(() => {
  ;(global as any).window.api = {
    ...(global as any).window.api,
    gitBranches: vi.fn().mockResolvedValue([]),
  }
  useFileStore.setState({ projectRoot: null })
})

afterEach(() => {
  cleanup()
  useEditorSettingsStore.setState({ blameAnnotationsEnabled: true, blameDisplayMode: 'footer' })
})

describe('GitSettingsPage — Blame section', () => {
  it('shows the "Show blame in" dropdown while blame is on', () => {
    useEditorSettingsStore.setState({ blameAnnotationsEnabled: true })
    render(<GitSettingsPage />)
    expect(screen.getByLabelText('Show blame in')).toBeInTheDocument()
  })

  it('dims the dropdown while blame is off', () => {
    useEditorSettingsStore.setState({ blameAnnotationsEnabled: false })
    render(<GitSettingsPage />)
    expect(screen.getByLabelText('Show blame in')).toBeDisabled()
  })

  it('lists Footer as the first option', () => {
    render(<GitSettingsPage />)
    fireEvent.click(screen.getByLabelText('Show blame in'))
    const labels = screen.getAllByRole('option').map((o) => o.textContent)
    expect(labels).toEqual(['Footer', 'Editor (end of current line)'])
  })

  it('switches blame to the editor', () => {
    useEditorSettingsStore.setState({ blameDisplayMode: 'footer' })
    render(<GitSettingsPage />)
    fireEvent.click(screen.getByLabelText('Show blame in'))
    fireEvent.click(screen.getByRole('option', { name: 'Editor (end of current line)' }))
    expect(useEditorSettingsStore.getState().blameDisplayMode).toBe('editor')
  })
})
