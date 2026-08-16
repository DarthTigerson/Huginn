import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { GitPanel } from '../GitPanel'
import { useFileStore } from '@/stores/fileStore'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useGitStore, emptyRepoGitState } from '@/stores/gitStore'

beforeEach(() => {
  ;(global as any).window.api = {
    gitStatus: vi.fn().mockResolvedValue({ staged: [], unstaged: [] }),
    gitListIgnored: vi.fn().mockResolvedValue([]),
  }
  useFileStore.setState({ projectRoot: '/proj' })
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
    const select = screen.getByLabelText('Select repository') as HTMLSelectElement
    expect(select.value).toBe('/proj/repoA')
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
    fireEvent.change(screen.getByLabelText('Select repository'), { target: { value: '/proj/repoB' } })

    expect(useGitReposStore.getState().selectedRepo).toBe('/proj/repoB')
  })
})
