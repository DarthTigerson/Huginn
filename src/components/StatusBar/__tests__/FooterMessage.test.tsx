import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { FooterMessage } from '../FooterMessage'
import { useUpdateStore } from '@/stores/updateStore'
import { FOOTER_TIPS } from '@/lib/footerTips'

beforeEach(() => {
  useUpdateStore.setState({ available: null, status: 'idle' })
})

afterEach(() => {
  cleanup()
  useUpdateStore.setState({ available: null, status: 'idle' })
})

describe('FooterMessage — tip rotation', () => {
  it('shows one of the known tips when no update is available', () => {
    render(<FooterMessage />)
    const text = screen.getByText((content) => FOOTER_TIPS.includes(content))
    expect(text).toBeTruthy()
  })
})

describe('FooterMessage — update override', () => {
  it('shows an update-available message and starts the update on click', () => {
    const startUpdate = vi.fn()
    useUpdateStore.setState({ available: { version: '0.2.0', url: 'https://example.com' }, status: 'idle', startUpdate })
    render(<FooterMessage />)
    const button = screen.getByRole('button', { name: /Huginn v0\.2\.0 is available/ })
    fireEvent.click(button)
    expect(startUpdate).toHaveBeenCalled()
  })

  it('shows an updating message that is not clickable', () => {
    useUpdateStore.setState({ available: { version: '0.2.0', url: 'https://example.com' }, status: 'updating' })
    render(<FooterMessage />)
    const button = screen.getByRole('button', { name: /Updating Huginn/ })
    expect(button).toBeDisabled()
  })

  it('shows a restart message and restarts on click when ready', () => {
    const restart = vi.fn()
    useUpdateStore.setState({ available: { version: '0.2.0', url: 'https://example.com' }, status: 'ready', restart })
    render(<FooterMessage />)
    const button = screen.getByRole('button', { name: /click to restart/ })
    fireEvent.click(button)
    expect(restart).toHaveBeenCalled()
  })

  it('shows a retry message and starts the update again when failed', () => {
    const startUpdate = vi.fn()
    useUpdateStore.setState({ available: { version: '0.2.0', url: 'https://example.com' }, status: 'failed', startUpdate })
    render(<FooterMessage />)
    const button = screen.getByRole('button', { name: /Update failed/ })
    fireEvent.click(button)
    expect(startUpdate).toHaveBeenCalled()
  })
})
