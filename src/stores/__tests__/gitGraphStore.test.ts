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

vi.stubGlobal('window', {
  api: {
    gitGraph: vi.fn().mockResolvedValue(mockCommits),
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
})
