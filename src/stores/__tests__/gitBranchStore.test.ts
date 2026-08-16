import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useGitBranchStore, useRepoBranchState, emptyRepoBranchState } from '../gitBranchStore'
import type { GitBranchList } from '@/types/index'

// useRepoBranchState is a React hook (it calls the useGitBranchStore hook internally),
// so it can't be invoked as a bare function outside a component render — doing so hits
// React's "invalid hook call" path. This suite otherwise runs in the plain `node` vitest
// environment (see vitest.config.ts) and stubs `window` wholesale via vi.stubGlobal,
// which is incompatible with a real DOM render (jsdom + @testing-library/react's
// renderHook). A synchronous SSR render via react-dom/server needs neither `window` nor
// `document` and correctly drives zustand's useSyncExternalStore server-snapshot path,
// so it's used here just to invoke the hook under test.
function callHook<T>(hook: () => T): T {
  let captured!: T
  function Probe() {
    captured = hook()
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  return captured
}

const mockBranchList: GitBranchList = {
  current: 'main',
  local: ['main', 'feature-x'],
  remote: ['origin/feat/remote-only'],
}

vi.stubGlobal('window', {
  api: {
    gitBranchList: vi.fn().mockResolvedValue(mockBranchList),
  },
})

describe('gitBranchStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGitBranchStore.setState({ repos: {} })
  })

  it('starts empty and useRepoBranchState falls back to defaults', () => {
    expect(useGitBranchStore.getState().repos).toEqual({})
    expect(callHook(() => useRepoBranchState('/proj'))).toEqual(emptyRepoBranchState)
    expect(callHook(() => useRepoBranchState(null))).toEqual(emptyRepoBranchState)
  })

  it('load sets loading for that repo while in flight and populates state on success', async () => {
    const loadPromise = useGitBranchStore.getState().load('/proj')
    expect(useGitBranchStore.getState().repos['/proj'].loading).toBe(true)
    await loadPromise
    const state = useGitBranchStore.getState().repos['/proj']
    expect(window.api.gitBranchList).toHaveBeenCalledWith('/proj')
    expect(state).toEqual({ ...mockBranchList, loading: false })
  })

  it('loading one repo does not touch another repo already in state', async () => {
    useGitBranchStore.setState({ repos: { '/other': { current: 'dev', local: ['dev'], remote: [], loading: false } } })
    await useGitBranchStore.getState().load('/proj')
    expect(useGitBranchStore.getState().repos['/other'].current).toBe('dev')
  })
})
