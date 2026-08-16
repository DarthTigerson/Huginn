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
  ;(global as any).window.api = {
    gitBranches: vi.fn().mockResolvedValue(['main', 'develop', 'feature-x']),
    gitBranch: vi.fn().mockResolvedValue('feature-x'),
    gitDefaultBranch: vi.fn().mockResolvedValue('origin/main'),
    gitBranchDiff: vi.fn().mockResolvedValue({ source: 'feature-x', target: 'main', commits: [commit] }),
    gitShowStat: vi.fn().mockResolvedValue(['src/App.tsx']),
  }
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
    selectedHash: null,
  })
})

afterEach(() => {
  cleanup()
})

describe('GitBranchDiffPage — selection survives a tab switch away and back', () => {
  it('keeps the chosen target branch and selected commit after unmount + remount', async () => {
    const { unmount } = render(<GitBranchDiffPage />)

    await waitFor(() => expect(useGitBranchDiffStore.getState().branches.length).toBeGreaterThan(0))
    // The user picks a different target than the auto-chosen default.
    fireEvent.click(screen.getByText('Target branch').closest('div')!.querySelector('button')!)
    fireEvent.click(screen.getByRole('option', { name: 'develop' }))
    await waitFor(() => expect(useGitBranchDiffStore.getState().target).toBe('develop'))

    await waitFor(() => expect(screen.getByText('Fix bug')).toBeTruthy())
    fireEvent.click(screen.getByText('Fix bug'))
    await waitFor(() => expect(useGitBranchDiffStore.getState().selectedHash).toBe('abc123def456'))
    expect(await screen.findByText('Commit Details')).toBeTruthy()

    // Simulates opening a file from the commit's changed-files list, which
    // backgrounds (unmounts) this tab, and then switching back to it.
    unmount()
    render(<GitBranchDiffPage />)

    await waitFor(() => expect(useGitBranchDiffStore.getState().target).toBe('develop'))
    expect(await screen.findByText('Commit Details')).toBeTruthy()
  })

  it('does NOT keep a selected commit that no longer exists once the branch pair actually changes', async () => {
    render(<GitBranchDiffPage />)

    await waitFor(() => expect(screen.getByText('Fix bug')).toBeTruthy())
    fireEvent.click(screen.getByText('Fix bug'))
    await waitFor(() => expect(useGitBranchDiffStore.getState().selectedHash).toBe('abc123def456'))

    vi.mocked(window.api.gitBranchDiff).mockResolvedValueOnce({ source: 'feature-x', target: 'develop', commits: [] })
    fireEvent.click(screen.getByText('Target branch').closest('div')!.querySelector('button')!)
    fireEvent.click(screen.getByRole('option', { name: 'develop' }))

    await waitFor(() => expect(useGitBranchDiffStore.getState().selectedHash).toBeNull())
  })
})
