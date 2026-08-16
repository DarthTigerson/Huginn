/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { DockerSettingsPage } from '../DockerSettingsPage'
import { useDockerSettingsStore } from '@/stores/dockerSettingsStore'

afterEach(() => {
  cleanup()
  useDockerSettingsStore.setState({ enabled: false })
})

describe('DockerSettingsPage', () => {
  it('renders the Enable Docker toggle off by default', () => {
    render(<DockerSettingsPage />)
    const toggle = screen.getByRole('switch', { name: 'Enable Docker' })
    expect(toggle).not.toBeDisabled()
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('clicking the toggle enables Docker in the store', () => {
    render(<DockerSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Docker' }))
    expect(useDockerSettingsStore.getState().enabled).toBe(true)
  })
})
