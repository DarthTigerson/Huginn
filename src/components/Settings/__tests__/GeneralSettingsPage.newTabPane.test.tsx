/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { GeneralSettingsPage } from '../GeneralSettingsPage'
import { useGeneralSettingsStore } from '@/stores/generalSettingsStore'
import { useConfigRepoStore } from '@/stores/configRepoStore'

beforeEach(() => {
  useConfigRepoStore.setState({ loaded: true, load: vi.fn() } as never)
  useGeneralSettingsStore.setState({ newTabPane: 'biggest' })
})
afterEach(cleanup)

describe('GeneralSettingsPage — Open new tabs in', () => {
  it('offers Active window and Biggest window, explaining the current choice', () => {
    render(<GeneralSettingsPage />)
    expect(screen.getByRole('radiogroup', { name: 'Open new tabs in' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Biggest window' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/largest editor window/)).toBeInTheDocument()
  })

  it('switches to the active window and explains that instead', () => {
    render(<GeneralSettingsPage />)
    fireEvent.click(screen.getByRole('radio', { name: 'Active window' }))
    expect(useGeneralSettingsStore.getState().newTabPane).toBe('active')
    expect(screen.getByText(/window you last clicked in/)).toBeInTheDocument()
  })

  it('no longer has the old biggest-pane switch', () => {
    render(<GeneralSettingsPage />)
    expect(screen.queryByRole('switch', { name: /biggest/i })).toBeNull()
  })
})
