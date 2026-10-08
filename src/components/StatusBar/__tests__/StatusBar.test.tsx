import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { StatusBar } from '../StatusBar'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteSessionStore } from '@/stores/autocompleteSessionStore'
import { useAutocompleteStatusStore } from '@/stores/autocompleteStatusStore'
import { useGitStore, emptyRepoGitState } from '@/stores/gitStore'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useFileStore } from '@/stores/fileStore'
import { useUsageAlertStore } from '@/stores/usageAlertStore'
import { useNotificationPanelStore } from '@/stores/notificationPanelStore'
import { useNotificationAcknowledgedStore } from '@/stores/notificationAcknowledgedStore'
import { useNotificationArrivalStore } from '@/stores/notificationArrivalStore'

beforeEach(() => {
  ;(global as any).window.api = {
    gitBranch: async () => null,
    gitAheadBehind: async () => null,
  }
})

afterEach(() => {
  cleanup()
  useAutocompleteSettingsStore.setState({ enabled: true, model: 'claude-haiku-4-5-20251001' })
  useAutocompleteSessionStore.setState({ paused: false })
  useAutocompleteStatusStore.setState({ busy: false })
  useGitStore.setState({ repos: {} })
  useGitReposStore.setState({ repos: [], selectedRepo: null })
})

describe('StatusBar autocomplete icon', () => {
  // Autocomplete is force-disabled while VIDE-16 reworks it (see
  // autocompleteEffectiveState.ts) — the icon must stay hidden regardless
  // of the persisted setting, including for pre-existing users who already
  // had it enabled.
  it('does not render the icon even when enabled in settings', () => {
    useAutocompleteSettingsStore.setState({ enabled: true })
    render(<StatusBar />)
    expect(screen.queryByRole('button', { name: 'Autocomplete off' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Autocomplete on' })).toBeNull()
  })

  it('does not render the icon when disabled in settings', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    render(<StatusBar />)
    expect(screen.queryByRole('button', { name: 'Autocomplete off' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Autocomplete on' })).toBeNull()
  })

  it('renders no autocomplete-related popup (no button to open it from)', () => {
    render(<StatusBar />)

    expect(screen.queryByText('Pause for this session')).toBeNull()
    expect(screen.queryByText('Resume')).toBeNull()
  })
})

describe('StatusBar git icon', () => {
  beforeEach(() => {
    // StatusBar's own mount effect calls refresh(projectRoot), which would
    // otherwise race our manually-set branch/commandStatus back to null —
    // give it a projectRoot + matching gitBranch mock so it settles on the
    // same branch we're asserting about instead of fighting it.
    ;(global as any).window.api = {
      gitBranch: async () => 'main',
      gitAheadBehind: async () => null,
      gitStatus: async () => ({ staged: [], unstaged: [] }),
      gitListIgnored: async () => [],
    }
    useFileStore.setState({ projectRoot: '/proj' })
    useGitReposStore.setState({ repos: ['/proj'], selectedRepo: '/proj' })
  })

  afterEach(() => {
    useFileStore.setState({ projectRoot: null })
    useGitReposStore.setState({ repos: [], selectedRepo: null })
  })

  function gitIcon(container: HTMLElement): SVGElement {
    return container.querySelectorAll('svg')[0] as unknown as SVGElement
  }

  it('does not flash while idle', async () => {
    const { container } = render(<StatusBar />)
    await waitFor(() => expect(useGitStore.getState().repos['/proj']?.branch).toBe('main'))
    expect(gitIcon(container).getAttribute('class')).not.toContain('text-accent')
  })

  it('flashes while a visible git command is running', async () => {
    const { container } = render(<StatusBar />)
    await waitFor(() => expect(useGitStore.getState().repos['/proj']?.branch).toBe('main'))
    act(() => {
      useGitStore.setState((s) => ({
        repos: { ...s.repos, '/proj': { ...(s.repos['/proj'] ?? emptyRepoGitState), commandStatus: 'running' } },
      }))
    })
    expect(gitIcon(container).getAttribute('class')).toContain('text-accent')
  })

  it('flashes while a silent background fetch is in flight', async () => {
    const { container } = render(<StatusBar />)
    await waitFor(() => expect(useGitStore.getState().repos['/proj']?.branch).toBe('main'))
    act(() => {
      useGitStore.setState((s) => ({
        repos: { ...s.repos, '/proj': { ...(s.repos['/proj'] ?? emptyRepoGitState), silentFetchInFlight: true } },
      }))
    })
    expect(gitIcon(container).getAttribute('class')).toContain('text-accent')
  })
})

describe('StatusBar — multi-repo branch display', () => {
  beforeEach(() => {
    ;(global as any).window.api = {
      gitBranch: async () => 'main',
      gitAheadBehind: async () => null,
      gitStatus: async () => ({ staged: [], unstaged: [] }),
      gitListIgnored: async () => [],
    }
  })

  afterEach(() => {
    useGitReposStore.setState({ repos: [], selectedRepo: null, hasExplicitSelection: false })
  })

  it('shows nothing until a repo has been explicitly selected', () => {
    useGitReposStore.setState({
      repos: ['/parent/repoA', '/parent/repoB'],
      selectedRepo: '/parent/repoA',
      hasExplicitSelection: false,
    })
    useGitStore.setState({ repos: { '/parent/repoA': { ...emptyRepoGitState, branch: 'main' } } })

    render(<StatusBar />)

    expect(screen.queryByText('main')).toBeNull()
  })

  it('shows "repoName › branch" with the repo name bold once a repo is explicitly selected', () => {
    useGitReposStore.setState({
      repos: ['/parent/repoA', '/parent/repoB'],
      selectedRepo: '/parent/repoB',
      hasExplicitSelection: true,
    })
    useGitStore.setState({ repos: { '/parent/repoB': { ...emptyRepoGitState, branch: 'main' } } })

    render(<StatusBar />)

    const repoName = screen.getByText('repoB')
    expect(repoName.className).toContain('font-bold')
    expect(screen.getByText('main')).toBeTruthy()
  })

  it('opens the git quick-actions menu on left click as well as right click', () => {
    useGitReposStore.setState({ repos: ['/proj'], selectedRepo: '/proj', hasExplicitSelection: false })
    useGitStore.setState({ repos: { '/proj': { ...emptyRepoGitState, branch: 'main' } } })

    render(<StatusBar />)
    fireEvent.click(screen.getByText('main'))
    expect(screen.getByText('Fetch')).toBeInTheDocument()
  })

  it('single-repo projects show "repoName › branch" immediately too, regardless of hasExplicitSelection', () => {
    useGitReposStore.setState({ repos: ['/proj'], selectedRepo: '/proj', hasExplicitSelection: false })
    useGitStore.setState({ repos: { '/proj': { ...emptyRepoGitState, branch: 'main' } } })

    render(<StatusBar />)

    expect(screen.getByText('main')).toBeTruthy()
    expect(screen.getByText('proj')).toBeTruthy()
  })
})

describe('StatusBar — notification bell, panel and clock', () => {
  afterEach(() => {
    useUsageAlertStore.setState({ alerts: [] })
    useNotificationPanelStore.setState({ open: false })
    useNotificationAcknowledgedStore.setState({ acknowledgedIds: [] })
    useNotificationArrivalStore.setState({ knownIds: [], arrival: null })
  })

  it('always shows the clock in the footer, even with a notification active', () => {
    useUsageAlertStore.setState({ alerts: [{ scope: 'session', cutoffAt: Date.now() + 60_000, resetAt: null }] })
    render(<StatusBar />)
    expect(screen.getByTestId('footer-clock')).toBeInTheDocument()
  })

  it('clicking the bell makes the notification panel visible in the same render tree', () => {
    useUsageAlertStore.setState({ alerts: [{ scope: 'session', cutoffAt: Date.now() + 60_000, resetAt: null }] })
    render(<StatusBar />)

    const panel = screen.getByTestId('notification-panel')
    expect(panel.className).toMatch(/opacity-0/)

    fireEvent.mouseUp(screen.getByTestId('notification-bell'), { button: 0 })
    expect(panel.className).toMatch(/opacity-100/)
  })

  it('clicking the bell again closes the panel instead of reopening it', () => {
    useUsageAlertStore.setState({ alerts: [{ scope: 'session', cutoffAt: Date.now() + 60_000, resetAt: null }] })
    render(<StatusBar />)
    const bell = screen.getByTestId('notification-bell')

    fireEvent.mouseUp(bell, { button: 0 })
    expect(useNotificationPanelStore.getState().open).toBe(true)

    fireEvent.mouseDown(bell)
    fireEvent.mouseUp(bell, { button: 0 })
    expect(useNotificationPanelStore.getState().open).toBe(false)
  })

  it('closing the panel turns the bell from unread to seen, and the panel still lists the item', () => {
    useUsageAlertStore.setState({ alerts: [{ scope: 'session', cutoffAt: Date.now() + 60_000, resetAt: null }] })
    render(<StatusBar />)
    const bell = screen.getByTestId('notification-bell')
    expect(bell.className).toMatch(/bg-accent/)

    fireEvent.mouseUp(bell, { button: 0 })
    fireEvent.mouseDown(document.body)
    expect(useNotificationPanelStore.getState().open).toBe(false)
    expect(screen.getByTestId('notification-bell').className).not.toMatch(/bg-accent/)

    fireEvent.mouseUp(screen.getByTestId('notification-bell'), { button: 0 })
    expect(screen.getByTestId('notification-panel').textContent).toMatch(/Session usage may run out/)
  })
})
