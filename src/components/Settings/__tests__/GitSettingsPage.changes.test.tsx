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
  useEditorSettingsStore.setState({ inlineDiffEnabled: true, inlineDiffColors: 'default', inlineDiffStrength: 'medium', inlineDiffFooterIcon: true })
})

afterEach(cleanup)

describe('GitSettingsPage — Changes section', () => {
  it('shows Strength even while the inline diff highlight is off', () => {
    useEditorSettingsStore.setState({ inlineDiffEnabled: false })
    render(<GitSettingsPage />)
    expect(screen.getByRole('radiogroup', { name: 'Inline diff strength' })).toBeInTheDocument()
  })

  it('keeps the colour choice usable while the highlight is off', () => {
    useEditorSettingsStore.setState({ inlineDiffEnabled: false })
    render(<GitSettingsPage />)
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }))
    expect(useEditorSettingsStore.getState().inlineDiffColors).toBe('custom')
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

  it('toggles the footer icon, even while the highlight is off', () => {
    useEditorSettingsStore.setState({ inlineDiffEnabled: false })
    render(<GitSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: /Show icon in footer/ }))
    expect(useEditorSettingsStore.getState().inlineDiffFooterIcon).toBe(false)
  })
})
