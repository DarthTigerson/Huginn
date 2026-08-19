import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { GitBranchDiffPage } from '../GitBranchDiffPage'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useGitStore } from '@/stores/gitStore'
import { useGitBranchDiffStore } from '@/stores/gitBranchDiffStore'
import type { GitCommit } from '@/types/index'

const commit: GitCommit = {
  hash: 'abc123def456',
  subject: 'Fix bug',
  author: 'Test Author',
  date: '2026-01-01T00:00:00Z',
  parents: [],
  refs: [],
}

beforeEach(() => {
  useGitReposStore.setState({ repos: ['/proj'], selectedRepo: '/proj' })
  useGitStore.setState({ repos: { '/proj': { branch: 'feature-x' } } } as any)
  useGitBranchDiffStore.setState({
    branches: [],
    defaultBranch: null,
    source: '',
    target: '',
    commits: [],
    loadingBranches: false,
    loadingCommits: false,
    loadingMore: false,
    hasMore: false,
    selectedHash: null,
  })
})

afterEach(() => {
  cleanup()
})

describe('GitBranchDiffPage — refresh button', () => {
  it('is icon-only, spins while a reload is in flight, and re-fetches the same source/target on click', async () => {
    let resolveDiff!: (result: { source: string; target: string; commits: GitCommit[] }) => void
    const gitBranchDiff = vi.fn(() => new Promise((resolve) => { resolveDiff = resolve as typeof resolveDiff }))
    ;(global as any).window.api = {
      gitBranches: vi.fn().mockResolvedValue(['main', 'develop', 'feature-x']),
      gitBranch: vi.fn().mockResolvedValue('feature-x'),
      gitDefaultBranch: vi.fn().mockResolvedValue('origin/main'),
      gitBranchDiff,
      gitShowStat: vi.fn().mockResolvedValue([]),
    }

    render(<GitBranchDiffPage />)
    await waitFor(() => expect(gitBranchDiff).toHaveBeenCalledTimes(1))
    resolveDiff({ source: 'feature-x', target: 'main', commits: [commit] })
    await waitFor(() => expect(screen.getByText('Fix bug')).toBeTruthy())

    const button = screen.getByRole('button', { name: 'Refresh' })
    expect(button.textContent).toBe('')
    expect(button.querySelector('svg')?.classList.contains('animate-spin')).toBe(false)

    fireEvent.click(button)
    await waitFor(() => expect(gitBranchDiff).toHaveBeenCalledTimes(2))
    expect(gitBranchDiff).toHaveBeenLastCalledWith('/proj', 'feature-x', 'main')
    await waitFor(() => expect(button.querySelector('svg')?.classList.contains('animate-spin')).toBe(true))

    resolveDiff({ source: 'feature-x', target: 'main', commits: [commit] })
    await waitFor(() => expect(button.querySelector('svg')?.classList.contains('animate-spin')).toBe(false))
  })
})
