import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { AboutSettingsPage, formatCheckedAgo } from '../AboutSettingsPage'
import { useUpdateStore } from '@/stores/updateStore'
import { useChangelogStore } from '@/stores/changelogStore'

const RELEASES = [
  { version: '0.2.21', date: '2026-10-20', body: '- **Future**: not installed yet' },
  { version: '0.2.20', date: '2026-10-08', body: '- **Silent alarms**: from the footer clock\n- A smaller tweak\n\n**Bug fixes**\n- Fixed a thing' },
  { version: '0.2.19', date: '2026-09-29', body: '- **Git blame**: in the footer' },
]

const checkForUpdates = vi.fn(async () => {})
const startUpdate = vi.fn()
const openUpdatePage = vi.fn()

beforeEach(() => {
  vi.stubGlobal('__APP_VERSION__', '0.2.20')
  ;(window as any).api = { getChangelogReleases: vi.fn(async () => RELEASES) }
  useChangelogStore.setState({ justUpdated: null })
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
  it('lays the page out like the other settings pages: Version and Release history blocks', () => {
    render(<AboutSettingsPage />)
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Version', 'Release history'])
    expect(screen.getByRole('heading', { name: 'Release history' })).toBeInTheDocument()
  })

  it('shows the app icon beside the version', () => {
    render(<AboutSettingsPage />)
    expect(screen.getByRole('img', { name: 'vIDE' }).getAttribute('src')).toMatch(/icon/)
  })

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
    expect(options.map((o) => o.textContent)).toEqual(['v0.2.2120 Oct 2026', 'v0.2.208 Oct 2026', 'v0.2.1929 Sept 2026'])
    expect(within(options[1]).getByText('v0.2.20').className).toMatch(/text-accent/)
    expect(within(options[2]).getByText('v0.2.19').className ?? '').not.toMatch(/text-accent/)
    expect(screen.getByTestId('about-release-notes').textContent).toMatch(/Silent alarms/)
  })

  it('shows another release\'s notes when picked', async () => {
    render(<AboutSettingsPage />)
    fireEvent.click(await screen.findByRole('option', { name: /v0\.2\.19/ }))
    await waitFor(() => expect(screen.getByTestId('about-release-notes').textContent).toMatch(/Git blame/))
  })

  it('lays a release out as titled changes, then other changes and bug fixes', async () => {
    render(<AboutSettingsPage />)
    await screen.findByTestId('release-features')
    const notes = screen.getByTestId('about-release-notes')
    expect(within(screen.getByTestId('release-features')).getByText('Silent alarms')).toBeInTheDocument()
    expect(within(screen.getByTestId('release-features')).getByText('from the footer clock')).toBeInTheDocument()
    expect(within(notes).getByText('Other changes')).toBeInTheDocument()
    expect(screen.getByTestId('release-changes').textContent).toBe('A smaller tweak')
    expect(within(notes).getByText('Bug fixes')).toBeInTheDocument()
    expect(screen.getByTestId('release-fixes').textContent).toBe('Fixed a thing')
  })

  it('after an update, says which version it came from and marks the releases it brought in', async () => {
    useChangelogStore.setState({ justUpdated: { to: '0.2.20', from: '0.2.18' } })
    render(<AboutSettingsPage />)
    expect(screen.getByTestId('about-updated-from').textContent).toBe('Updated from v0.2.18')
    const list = await screen.findByRole('listbox', { name: 'Releases' })
    const marked = within(list).getAllByTestId('about-release-new').map((n) => n.closest('[role="option"]')!.textContent)
    // 0.2.19 and 0.2.20 came in with this update; 0.2.21 isn't installed
    expect(marked).toEqual(['v0.2.20New8 Oct 2026', 'v0.2.19New29 Sept 2026'])
  })

  it('says nothing about an update on a normal day', async () => {
    render(<AboutSettingsPage />)
    await screen.findByRole('listbox', { name: 'Releases' })
    expect(screen.queryByTestId('about-updated-from')).toBeNull()
    expect(screen.queryByTestId('about-release-new')).toBeNull()
  })
})

