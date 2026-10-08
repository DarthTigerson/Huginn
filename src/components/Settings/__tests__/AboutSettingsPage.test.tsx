import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { AboutSettingsPage, formatCheckedAgo } from '../AboutSettingsPage'
import { useUpdateStore } from '@/stores/updateStore'

const RELEASES = [
  { version: '0.2.20', date: '2026-10-08', body: '- **Silent alarms**: from the footer clock' },
  { version: '0.2.19', date: '2026-09-29', body: '- **Git blame**: in the footer' },
]

const checkForUpdates = vi.fn(async () => {})
const startUpdate = vi.fn()
const openUpdatePage = vi.fn()

beforeEach(() => {
  vi.stubGlobal('__APP_VERSION__', '0.2.20')
  ;(window as any).api = { getChangelogReleases: vi.fn(async () => RELEASES) }
  useUpdateStore.setState({
    available: null, status: 'idle', checking: false, lastCheckedAt: null, checkFailed: false,
    checkForUpdates, startUpdate, openUpdatePage, loadCheckStatus: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('formatCheckedAgo', () => {
  it('reads naturally', () => {
    const now = 10 * 24 * 3600_000
    expect(formatCheckedAgo(now - 20_000, now)).toBe('just now')
    expect(formatCheckedAgo(now - 5 * 60_000, now)).toBe('5 min ago')
    expect(formatCheckedAgo(now - 60 * 60_000, now)).toBe('1 hour ago')
    expect(formatCheckedAgo(now - 3 * 24 * 3600_000, now)).toBe('3 days ago')
  })
})

describe('AboutSettingsPage', () => {
  it('shows the running version in the primary colour', () => {
    render(<AboutSettingsPage />)
    const version = screen.getByTestId('about-version')
    expect(version.textContent).toBe('vIDE 0.2.20')
    expect(within(version).getByText('0.2.20').className).toMatch(/text-accent/)
  })

  it('shows "Up to date" with when it last checked, and checks on demand', () => {
    useUpdateStore.setState({ lastCheckedAt: Date.now() - 2 * 3600_000 })
    render(<AboutSettingsPage />)
    expect(screen.getByText('Up to date · checked 2 hours ago')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }))
    expect(checkForUpdates).toHaveBeenCalled()
  })

  it('shows Checking… while a check runs', () => {
    useUpdateStore.setState({ checking: true })
    render(<AboutSettingsPage />)
    expect(screen.getByText('Checking for updates…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled()
  })

  it('explains a failed check', () => {
    useUpdateStore.setState({ checkFailed: true })
    render(<AboutSettingsPage />)
    expect(screen.getByText(/Couldn't reach GitHub/)).toBeInTheDocument()
  })

  it('offers the update when one is found, starting it on the Update page', () => {
    useUpdateStore.setState({ available: { version: '0.2.21', url: 'u' } })
    render(<AboutSettingsPage />)
    expect(screen.getByText('vIDE v0.2.21 is available')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Update to v0.2.21' }))
    expect(startUpdate).toHaveBeenCalled()
  })

  it('while that update runs, the banner reopens the Update page instead', () => {
    useUpdateStore.setState({ available: { version: '0.2.21', url: 'u' }, status: 'updating' })
    render(<AboutSettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Update page' }))
    expect(openUpdatePage).toHaveBeenCalled()
  })

  it('lists releases with the running one in the primary colour, opening on its notes', async () => {
    render(<AboutSettingsPage />)
    const list = await screen.findByRole('listbox', { name: 'Releases' })
    const options = within(list).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['v0.2.208 Oct 2026', 'v0.2.1929 Sept 2026'])
    expect(within(options[0]).getByText('v0.2.20').className).toMatch(/text-accent/)
    expect(within(options[1]).getByText('v0.2.19').className ?? '').not.toMatch(/text-accent/)
    expect(screen.getByTestId('about-release-notes').textContent).toMatch(/Silent alarms/)
  })

  it('shows another release\'s notes when picked', async () => {
    render(<AboutSettingsPage />)
    fireEvent.click(await screen.findByRole('option', { name: /v0\.2\.19/ }))
    await waitFor(() => expect(screen.getByTestId('about-release-notes').textContent).toMatch(/Git blame/))
  })
})
