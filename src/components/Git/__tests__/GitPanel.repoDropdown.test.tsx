import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { GitPanel } from '../GitPanel'
import { useFileStore } from '@/stores/fileStore'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useGitStore, emptyRepoGitState } from '@/stores/gitStore'
import { useGitFavoriteReposStore } from '@/stores/gitFavoriteReposStore'
import { useSidebarUiStore } from '@/stores/sidebarUiStore'

beforeEach(() => {
  ;(global as any).window.api = {
    gitStatus: vi.fn().mockResolvedValue({ staged: [], unstaged: [] }),
    gitListIgnored: vi.fn().mockResolvedValue([]),
  }
  useFileStore.setState({ projectRoot: '/proj' })
  useGitFavoriteReposStore.setState({ favorites: {} })
  useSidebarUiStore.setState({ revealRequest: null })
})

afterEach(() => {
  cleanup()
})

describe('GitPanel — repo dropdown', () => {
  it('is hidden when only one repo is open', () => {
    useGitReposStore.setState({ repos: ['/proj'], selectedRepo: '/proj' })
    useGitStore.setState({ repos: { '/proj': { ...emptyRepoGitState } } })
    render(<GitPanel />)
    expect(screen.queryByLabelText('Select repository')).toBeNull()
  })

  it('is shown and lists every repo when more than one is open', () => {
    useGitReposStore.setState({ repos: ['/proj/repoA', '/proj/repoB'], selectedRepo: '/proj/repoA' })
    useGitStore.setState({
      repos: {
        '/proj/repoA': { ...emptyRepoGitState },
        '/proj/repoB': { ...emptyRepoGitState },
      },
    })
    render(<GitPanel />)
    const trigger = screen.getByLabelText('Select repository')
    expect(trigger.textContent).toContain('repoA')

    fireEvent.click(trigger)
    expect(screen.getByRole('option', { name: 'repoA' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'repoB' })).toBeTruthy()
  })

  it('picking a different repo calls selectRepo and scopes the panel to it', () => {
    useGitReposStore.setState({ repos: ['/proj/repoA', '/proj/repoB'], selectedRepo: '/proj/repoA' })
    useGitStore.setState({
      repos: {
        '/proj/repoA': { ...emptyRepoGitState, branch: 'main' },
        '/proj/repoB': { ...emptyRepoGitState, branch: 'dev' },
      },
    })
    render(<GitPanel />)
    fireEvent.click(screen.getByLabelText('Select repository'))
    fireEvent.click(screen.getByRole('option', { name: 'repoB' }))

    expect(useGitReposStore.getState().selectedRepo).toBe('/proj/repoB')
  })

  it('filters the repo list as the user types', () => {
    useGitReposStore.setState({
      repos: ['/proj/repoA', '/proj/repoB', '/proj/other'],
      selectedRepo: '/proj/repoA',
    })
    useGitStore.setState({
      repos: {
        '/proj/repoA': { ...emptyRepoGitState },
        '/proj/repoB': { ...emptyRepoGitState },
        '/proj/other': { ...emptyRepoGitState },
      },
    })
    render(<GitPanel />)
    fireEvent.click(screen.getByLabelText('Select repository'))
    fireEvent.change(screen.getByPlaceholderText('Find a repo'), { target: { value: 'repo' } })

    expect(screen.getByRole('option', { name: 'repoA' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'repoB' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'other' })).toBeNull()
  })

  it('starring a repo sorts it to the top of the dropdown', () => {
    useGitReposStore.setState({ repos: ['/proj/repoA', '/proj/repoB'], selectedRepo: '/proj/repoA' })
    useGitStore.setState({
      repos: {
        '/proj/repoA': { ...emptyRepoGitState },
        '/proj/repoB': { ...emptyRepoGitState },
      },
    })
    render(<GitPanel />)
    fireEvent.click(screen.getByLabelText('Select repository'))
    fireEvent.click(screen.getByLabelText('Favorite repoB'))

    expect(useGitFavoriteReposStore.getState().isFavorite('/proj/repoB')).toBe(true)
    const options = screen.getAllByRole('option').map((el) => el.textContent)
    expect(options).toEqual(['repoB', 'repoA'])
  })

  it('shows a "Reveal in File Tree" button next to the repo dropdown that requests a reveal for the selected repo', () => {
    useGitReposStore.setState({ repos: ['/proj/repoA', '/proj/repoB'], selectedRepo: '/proj/repoB' })
    useGitStore.setState({
      repos: {
        '/proj/repoA': { ...emptyRepoGitState },
        '/proj/repoB': { ...emptyRepoGitState },
      },
    })
    render(<GitPanel />)
    fireEvent.click(screen.getByLabelText('Reveal in File Tree'))

    expect(useSidebarUiStore.getState().revealRequest).toEqual({ path: '/proj/repoB', expandTarget: true })
  })

  it('clicking the star in the dropdown does not select that repo', () => {
    useGitReposStore.setState({ repos: ['/proj/repoA', '/proj/repoB'], selectedRepo: '/proj/repoA' })
    useGitStore.setState({
      repos: {
        '/proj/repoA': { ...emptyRepoGitState },
        '/proj/repoB': { ...emptyRepoGitState },
      },
    })
    render(<GitPanel />)
    fireEvent.click(screen.getByLabelText('Select repository'))
    fireEvent.click(screen.getByLabelText('Favorite repoB'))

    expect(useGitReposStore.getState().selectedRepo).toBe('/proj/repoA')
  })
})
