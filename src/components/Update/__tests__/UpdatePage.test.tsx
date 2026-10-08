import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { UpdatePage } from '../UpdatePage'
import { useUpdateStore } from '@/stores/updateStore'
import { useEditorStore } from '@/stores/editorStore'

const startUpdate = vi.fn()
const restart = vi.fn()

beforeEach(() => {
  useUpdateStore.setState({
    available: { version: '0.2.20', url: 'https://example.com' },
    status: 'idle', stage: null, failure: null, log: [], changelog: undefined,
    startUpdate, restart,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const stop = (name: string) => screen.getByTestId(`update-stop-${name}`).getAttribute('data-state')

describe('UpdatePage', () => {
  it('offers the update when one is available', () => {
    render(<UpdatePage />)
    expect(screen.getByText('vIDE v0.2.20 is available')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }))
    expect(startUpdate).toHaveBeenCalled()
  })

  it('says it is up to date when nothing is available', () => {
    useUpdateStore.setState({ available: null })
    render(<UpdatePage />)
    expect(screen.getByText('vIDE is up to date')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Update now' })).toBeNull()
  })

  it('shows Download in progress, then Install, on the track', () => {
    useUpdateStore.setState({ status: 'updating', stage: 'download' })
    const { rerender } = render(<UpdatePage />)
    expect([stop('download'), stop('install'), stop('ready')]).toEqual(['now', 'todo', 'todo'])
    expect(screen.getByTestId('update-subtitle').textContent).toBe('Downloading…')

    useUpdateStore.setState({ stage: 'install' })
    rerender(<UpdatePage />)
    expect([stop('download'), stop('install'), stop('ready')]).toEqual(['done', 'now', 'todo'])
  })

  it('explains the macOS password prompt instead of looking stuck', () => {
    useUpdateStore.setState({ status: 'updating', stage: 'password' })
    render(<UpdatePage />)
    expect(screen.getByTestId('update-subtitle').textContent).toBe('Waiting for your password')
    expect(screen.getByText(/macOS is asking for your password/)).toBeInTheDocument()
  })

  it('offers Restart now and Later on the same page once installed', () => {
    useUpdateStore.setState({ status: 'ready' })
    const closeTab = vi.fn()
    useEditorStore.setState({ closeTab })
    render(<UpdatePage />)
    expect([stop('download'), stop('install'), stop('ready')]).toEqual(['done', 'done', 'done'])
    fireEvent.click(screen.getByRole('button', { name: 'Restart now' }))
    expect(restart).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(closeTab).toHaveBeenCalledWith('update://Update')
  })

  it('explains a failure and offers Try again, with the raw output under Show details', () => {
    useUpdateStore.setState({
      status: 'failed', stage: 'password', failure: 'admin-declined',
      log: [{ line: 'Installing to /Applications...', stream: 'stdout' }, { line: 'Update cancelled: administrator rights are required.', stream: 'stderr' }],
    })
    render(<UpdatePage />)
    expect(screen.getByText("The update didn't finish")).toBeInTheDocument()
    expect(screen.getByTestId('update-subtitle').textContent).toMatch(/Administrator rights were declined, so nothing was changed\./)
    expect(stop('install')).toBe('fail')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(startUpdate).toHaveBeenCalled()

    expect(screen.queryByTestId('update-log')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show details/ }))
    expect(screen.getByTestId('update-log').textContent).toMatch(/Update cancelled/)
  })

  it('shows a short list of what is new, with the full notes one click away', () => {
    useUpdateStore.setState({
      changelog: '- **Silent alarms**: from the footer clock, with a long explanation\n- A smaller tweak\n\n**Bug fixes**\n- Fixed a thing',
    })
    render(<UpdatePage />)
    const news = screen.getByTestId('update-whats-new')
    expect(news.textContent).toMatch(/What's new in v0\.2\.20/)
    expect(screen.getByTestId('update-highlights').textContent).toBe('Silent alarmsPlus 1 smaller change and 1 bug fix')
    expect(news.textContent).not.toMatch(/long explanation/)

    fireEvent.click(screen.getByRole('button', { name: /Full release notes/ }))
    expect(news.textContent).toMatch(/long explanation/)
    expect(screen.queryByTestId('update-highlights')).toBeNull()
  })

  it('leaves out What\'s new while it is loading or could not be fetched', () => {
    render(<UpdatePage />)
    expect(screen.queryByTestId('update-whats-new')).toBeNull()
    useUpdateStore.setState({ changelog: null })
    cleanup()
    render(<UpdatePage />)
    expect(screen.queryByTestId('update-whats-new')).toBeNull()
  })
})
