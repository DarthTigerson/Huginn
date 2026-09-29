/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { FileTreeSettingsPage } from '../FileTreeSettingsPage'
import { useGeneralSettingsStore } from '@/stores/generalSettingsStore'

beforeEach(() => {
  useGeneralSettingsStore.setState({ fileTreeGitStatus: 'letterAndColour' })
})

afterEach(() => {
  cleanup()
})

describe('FileTreeSettingsPage', () => {
  it('offers Off, Letter, and Letter + Colour, with the current choice selected', () => {
    render(<FileTreeSettingsPage />)
    const group = screen.getByRole('radiogroup', { name: 'Git status in file tree' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((r) => r.textContent)).toEqual(['Off', 'Letter', 'Letter + Colour'])
    expect(within(group).getByRole('radio', { name: 'Letter + Colour' })).toHaveAttribute('aria-checked', 'true')
  })

  it('switches the file tree to letters only', () => {
    render(<FileTreeSettingsPage />)
    fireEvent.click(screen.getByRole('radio', { name: 'Letter' }))
    expect(useGeneralSettingsStore.getState().fileTreeGitStatus).toBe('letter')
  })
})
