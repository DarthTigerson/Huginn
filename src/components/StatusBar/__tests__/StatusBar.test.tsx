import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { StatusBar } from '../StatusBar'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteSessionStore } from '@/stores/autocompleteSessionStore'
import { useAutocompleteStatusStore } from '@/stores/autocompleteStatusStore'
import { useGitStore } from '@/stores/gitStore'
import { useFileStore } from '@/stores/fileStore'

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
  useGitStore.setState({ branch: null, commandStatus: 'idle', silentFetchInFlight: false })
})

describe('StatusBar autocomplete icon', () => {
  it('does not render the icon at all when disabled in settings', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    render(<StatusBar />)
    expect(screen.queryByRole('button', { name: 'Autocomplete off' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Autocomplete on' })).toBeNull()
  })

  it('shows the active icon when enabled and not paused', () => {
    render(<StatusBar />)
    expect(screen.getByRole('button', { name: 'Autocomplete on' })).toBeTruthy()
  })

  it('opens a pause popup on click when enabled', () => {
    render(<StatusBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Autocomplete on' }))
    expect(screen.getByText('Pause for this session')).toBeTruthy()
  })

  it('pausing flips the session store and updates the popup label', () => {
    render(<StatusBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Autocomplete on' }))
    fireEvent.click(screen.getByText('Pause for this session'))

    expect(useAutocompleteSessionStore.getState().paused).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Autocomplete off' }))
    expect(screen.getByText('Resume')).toBeTruthy()
  })

  it('renders no autocomplete-related popup when disabled in settings (no button to open it from)', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    render(<StatusBar />)

    expect(screen.queryByText('Autocomplete is off in Settings')).toBeNull()
    expect(screen.queryByText('Pause for this session')).toBeNull()
    expect(screen.queryByText('Resume')).toBeNull()
  })

  it('opens the same popup on right-click', () => {
    render(<StatusBar />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Autocomplete on' }))
    expect(screen.getByText('Pause for this session')).toBeTruthy()
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
  })

  afterEach(() => {
    useFileStore.setState({ projectRoot: null })
  })

  function gitIcon(container: HTMLElement): SVGElement {
    return container.querySelectorAll('svg')[0] as unknown as SVGElement
  }

  it('does not flash while idle', async () => {
    const { container } = render(<StatusBar />)
    await waitFor(() => expect(useGitStore.getState().branch).toBe('main'))
    expect(gitIcon(container).getAttribute('class')).not.toContain('text-accent')
  })

  it('flashes while a visible git command is running', async () => {
    const { container } = render(<StatusBar />)
    await waitFor(() => expect(useGitStore.getState().branch).toBe('main'))
    act(() => { useGitStore.setState({ commandStatus: 'running' }) })
    expect(gitIcon(container).getAttribute('class')).toContain('text-accent')
  })

  it('flashes while a silent background fetch is in flight', async () => {
    const { container } = render(<StatusBar />)
    await waitFor(() => expect(useGitStore.getState().branch).toBe('main'))
    act(() => { useGitStore.setState({ silentFetchInFlight: true }) })
    expect(gitIcon(container).getAttribute('class')).toContain('text-accent')
  })
})
