import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
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

describe('GitGraphPage — refresh button', () => {
  it('is icon-only (no "Refresh" label) and spins while a reload is in flight', async () => {
    let resolveGitGraph!: (commits: GitCommit[]) => void
    const gitGraph = vi.fn(() => new Promise<GitCommit[]>((resolve) => { resolveGitGraph = resolve }))
    ;(global as any).window.api = { gitGraph, gitShowStat: vi.fn().mockResolvedValue([]) }
    useGitReposStore.setState({ repos: ['/proj'], selectedRepo: '/proj' })
    useGitGraphStore.setState({
      repos: { '/proj': { commits: [commit], selectedHash: null, loading: false, loadingMore: false, hasMore: false } },
    })

    render(<GitGraphPage />)
    // GitGraphPage's own mount effect calls load() immediately, so resolve
    // that first load before exercising the button's own click-triggered one.
    await waitFor(() => expect(gitGraph).toHaveBeenCalledTimes(1))
    resolveGitGraph([commit])

    const button = await screen.findByRole('button', { name: 'Refresh' })
    await waitFor(() => expect(button.querySelector('svg')?.classList.contains('animate-spin')).toBe(false))
    expect(button.textContent).toBe('')

    fireEvent.click(button)
    expect(gitGraph).toHaveBeenCalledTimes(2)
    expect(gitGraph).toHaveBeenLastCalledWith('/proj')
    await waitFor(() => expect(button.querySelector('svg')?.classList.contains('animate-spin')).toBe(true))

    resolveGitGraph([commit])
    await waitFor(() => expect(button.querySelector('svg')?.classList.contains('animate-spin')).toBe(false))
  })
})
