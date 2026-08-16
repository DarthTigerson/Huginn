import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { RepoOverviewList } from '../RepoOverviewList'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useGitStore, emptyRepoGitState } from '@/stores/gitStore'
import type { GitStatus, GitAheadBehind } from '@/types/index'

const repoAStatus: GitStatus = { staged: [{ path: 'a.ts', status: 'M' }], unstaged: [] }
const repoBStatus: GitStatus = { staged: [], unstaged: [] }
const repoAAheadBehind: GitAheadBehind = { ahead: 1, behind: 2 }

beforeEach(() => {
  ;(global as any).window.api = {
    gitBranch: vi.fn((cwd: string) => Promise.resolve(cwd.endsWith('repoA') ? 'main' : 'dev')),
    gitAheadBehind: vi.fn((cwd: string) => Promise.resolve(cwd.endsWith('repoA') ? repoAAheadBehind : null)),
    gitStatus: vi.fn((cwd: string) => Promise.resolve(cwd.endsWith('repoA') ? repoAStatus : repoBStatus)),
    gitListIgnored: vi.fn().mockResolvedValue([]),
  }
  useGitReposStore.setState({ repos: ['/proj/repoA', '/proj/repoB'], selectedRepo: '/proj/repoA' })
  useGitStore.setState({
    repos: {
      '/proj/repoA': { ...emptyRepoGitState, branch: 'main', status: repoAStatus, aheadBehind: repoAAheadBehind },
      '/proj/repoB': { ...emptyRepoGitState, branch: 'dev', status: repoBStatus, aheadBehind: null },
    },
  })
})

afterEach(() => {
  cleanup()
})

describe('RepoOverviewList', () => {
  it('lists every repo with its name, branch, and staged/unstaged counts', () => {
    render(<RepoOverviewList onClose={vi.fn()} />)
    expect(screen.getByText('repoA')).toBeTruthy()
    expect(screen.getByText('main')).toBeTruthy()
    expect(screen.getByText('repoB')).toBeTruthy()
    expect(screen.getByText('dev')).toBeTruthy()
  })

  it('shows ahead/behind counts when present', () => {
    render(<RepoOverviewList onClose={vi.fn()} />)
    expect(screen.getByText('↓2')).toBeTruthy()
    expect(screen.getByText('↑1')).toBeTruthy()
  })

  it('re-fetches every repo on mount', async () => {
    render(<RepoOverviewList onClose={vi.fn()} />)
    await waitFor(() => {
      expect(window.api.gitBranch).toHaveBeenCalledWith('/proj/repoA')
      expect(window.api.gitBranch).toHaveBeenCalledWith('/proj/repoB')
    })
  })

  it('clicking a row selects that repo and closes the overview', () => {
    const onClose = vi.fn()
    render(<RepoOverviewList onClose={onClose} />)
    fireEvent.click(screen.getByText('repoB'))
    expect(useGitReposStore.getState().selectedRepo).toBe('/proj/repoB')
    expect(onClose).toHaveBeenCalled()
  })
})
