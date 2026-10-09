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
  useEditorSettingsStore.setState({ inlineDiffEnabled: true, inlineDiffColors: 'default', inlineDiffStrength: 'medium' })
})

afterEach(cleanup)

describe('GitSettingsPage — Changes section', () => {
  it('shows Strength only while the inline diff highlight is on', () => {
    const { rerender } = render(<GitSettingsPage />)
    expect(screen.getByRole('radiogroup', { name: 'Inline diff strength' })).toBeInTheDocument()
    useEditorSettingsStore.setState({ inlineDiffEnabled: false })
    rerender(<GitSettingsPage />)
    expect(screen.queryByRole('radiogroup', { name: 'Inline diff strength' })).toBeNull()
  })

  it('sets the strength', () => {
    render(<GitSettingsPage />)
    fireEvent.click(screen.getByRole('radio', { name: 'Strong' }))
    expect(useEditorSettingsStore.getState().inlineDiffStrength).toBe('strong')
  })

  it('shows the three colour pickers only for Custom colours', () => {
    render(<GitSettingsPage />)
    expect(screen.queryByText('Added')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }))
    expect(useEditorSettingsStore.getState().inlineDiffColors).toBe('custom')
    expect(screen.getByText('Added')).toBeInTheDocument()
    expect(screen.getByText('Modified')).toBeInTheDocument()
    expect(screen.getByText('Deleted')).toBeInTheDocument()
  })
})
