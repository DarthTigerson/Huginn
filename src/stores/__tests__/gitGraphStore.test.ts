import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useGitGraphStore, useRepoGraphState, emptyRepoGraphState } from '../gitGraphStore'
import type { GitCommit } from '@/types/index'

// useRepoGraphState is a React hook (it calls useGitGraphStore hook internally),
// so it can't be invoked as a bare function outside a component render. This
// suite runs in the plain `node` vitest environment and stubs `window` via
// vi.stubGlobal. A synchronous SSR render via react-dom/server correctly drives
// zustand's useSyncExternalStore server-snapshot path without needing a DOM.
function callHook<T>(hook: () => T): T {
  let captured!: T
  function Probe() {
    captured = hook()
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  return captured
}

const mockCommits: GitCommit[] = [
  { hash: 'abc', parents: [], subject: 'init', author: 'Test', date: '2026-01-01', refs: [] },
]

function makeCommits(count: number, prefix: string): GitCommit[] {
  return Array.from({ length: count }, (_, i) => ({
    hash: `${prefix}${i}`,
    parents: [],
    subject: `${prefix} ${i}`,
    author: 'Test',
    date: '2026-01-01',
    refs: [],
  }))
}

const gitGraphMock = vi.fn().mockResolvedValue(mockCommits)

vi.stubGlobal('window', {
  api: {
    gitGraph: gitGraphMock,
  },
})

describe('gitGraphStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGitGraphStore.setState({ repos: {} })
  })

  it('starts empty and useRepoGraphState falls back to defaults', () => {
    expect(callHook(() => useRepoGraphState('/proj'))).toEqual(emptyRepoGraphState)
    expect(callHook(() => useRepoGraphState(null))).toEqual(emptyRepoGraphState)
  })

  it('load populates commits for that repo and clears loading', async () => {
    const loadPromise = useGitGraphStore.getState().load('/proj')
    expect(useGitGraphStore.getState().repos['/proj'].loading).toBe(true)
    await loadPromise
    expect(window.api.gitGraph).toHaveBeenCalledWith('/proj')
    expect(useGitGraphStore.getState().repos['/proj'].commits).toEqual(mockCommits)
    expect(useGitGraphStore.getState().repos['/proj'].loading).toBe(false)
  })

  it('load preserves that repo\'s existing selectedHash', async () => {
    useGitGraphStore.setState({ repos: { '/proj': { ...emptyRepoGraphState, selectedHash: 'abc' } } })
    await useGitGraphStore.getState().load('/proj')
    expect(useGitGraphStore.getState().repos['/proj'].selectedHash).toBe('abc')
  })

  it('select sets selectedHash for the given repo only', () => {
    useGitGraphStore.setState({
      repos: { '/repoA': { ...emptyRepoGraphState }, '/repoB': { ...emptyRepoGraphState } },
    })
    useGitGraphStore.getState().select('/repoA', 'abc')
    expect(useGitGraphStore.getState().repos['/repoA'].selectedHash).toBe('abc')
    expect(useGitGraphStore.getState().repos['/repoB'].selectedHash).toBeNull()
  })

  it('load sets hasMore true when a full page comes back, false when it is short', async () => {
    gitGraphMock.mockResolvedValueOnce(makeCommits(100, 'full'))
    await useGitGraphStore.getState().load('/proj')
    expect(useGitGraphStore.getState().repos['/proj'].hasMore).toBe(true)

    gitGraphMock.mockResolvedValueOnce(makeCommits(3, 'short'))
    await useGitGraphStore.getState().load('/proj')
    expect(useGitGraphStore.getState().repos['/proj'].hasMore).toBe(false)
  })

  it('loadMore appends the next page using the current commit count as the offset', async () => {
    gitGraphMock.mockResolvedValueOnce(makeCommits(100, 'page1'))
    await useGitGraphStore.getState().load('/proj')

    gitGraphMock.mockResolvedValueOnce(makeCommits(10, 'page2'))
    const loadMorePromise = useGitGraphStore.getState().loadMore('/proj')
    expect(useGitGraphStore.getState().repos['/proj'].loadingMore).toBe(true)
    await loadMorePromise

    expect(gitGraphMock).toHaveBeenLastCalledWith('/proj', 100)
    expect(useGitGraphStore.getState().repos['/proj'].commits).toHaveLength(110)
    expect(useGitGraphStore.getState().repos['/proj'].loadingMore).toBe(false)
    expect(useGitGraphStore.getState().repos['/proj'].hasMore).toBe(false)
  })

  it('loadMore is a no-op once hasMore is false', async () => {
    useGitGraphStore.setState({
      repos: { '/proj': { ...emptyRepoGraphState, commits: mockCommits, hasMore: false } },
    })
    await useGitGraphStore.getState().loadMore('/proj')
    expect(gitGraphMock).not.toHaveBeenCalled()
  })
})
