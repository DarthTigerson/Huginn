import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { GitGraphPage } from '../GitGraphPage'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useGitGraphStore } from '@/stores/gitGraphStore'
import type { GitCommit } from '@/types/index'

const commit: GitCommit = {
  hash: 'abc123def456',
  subject: 'Fix bug',
  author: 'Test Author',
  date: '2026-01-01T00:00:00Z',
  parents: [],
  refs: [],
}

afterEach(() => {
  cleanup()
})

describe('GitGraphPage — selection survives a tab switch away and back', () => {
  it('keeps the commit details panel showing after unmount + remount, since selectedHash lives in gitGraphStore, not local state', async () => {
    ;(global as any).window.api = {
      gitGraph: vi.fn().mockResolvedValue([commit]),
      gitShowStat: vi.fn().mockResolvedValue(['src/App.tsx']),
    }
    useGitReposStore.setState({ repos: ['/proj'], selectedRepo: '/proj' })
    useGitGraphStore.setState({
      repos: { '/proj': { commits: [commit], selectedHash: 'abc123def456', loading: false, loadingMore: false, hasMore: false } },
    })

    const { unmount } = render(<GitGraphPage />)
    expect(await screen.findByText('Commit Details')).toBeTruthy()

    // Editor.tsx unmounts a tab's content when it's no longer the active
    // tab in its pane (e.g. the user opened a file from this commit's
    // changed-files list) — this simulates that.
    unmount()

    render(<GitGraphPage />)
    expect(await screen.findByText('Commit Details')).toBeTruthy()
  })
})
