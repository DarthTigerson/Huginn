// @vitest-environment jsdom
//
// This suite needs to read useRepoGitLogText's value *after* store mutations
// (append), not just its default. zustand's plain-`node`-environment escape
// hatch used elsewhere in this directory (see gitStore.test.ts's callHook,
// a synchronous SSR render via react-dom/server) only works for reading a
// hook's default: React's useSyncExternalStore treats a `window`-less
// environment as server rendering and calls zustand's getServerSnapshot,
// which is pinned to the store's state *at creation time* — so it can never
// observe a later setState/append no matter when the render happens. A real
// DOM render (jsdom, via @testing-library/react's renderHook) exercises the
// live getSnapshot path instead and picks up mutations correctly.
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGitLogStore, useRepoGitLogText } from '../gitLogStore'

describe('gitLogStore', () => {
  beforeEach(() => {
    useGitLogStore.setState({ repos: {} })
  })

  it('starts empty and useRepoGitLogText falls back to an empty string', () => {
    expect(renderHook(() => useRepoGitLogText('/proj')).result.current).toBe('')
    expect(renderHook(() => useRepoGitLogText(null)).result.current).toBe('')
  })

  it('append accumulates text for the given repo', () => {
    useGitLogStore.getState().append('/proj', 'line 1\n')
    useGitLogStore.getState().append('/proj', 'line 2\n')
    expect(renderHook(() => useRepoGitLogText('/proj')).result.current).toBe('line 1\nline 2\n')
  })

  it('append keeps separate repos independent', () => {
    useGitLogStore.getState().append('/repoA', 'a')
    useGitLogStore.getState().append('/repoB', 'b')
    expect(renderHook(() => useRepoGitLogText('/repoA')).result.current).toBe('a')
    expect(renderHook(() => useRepoGitLogText('/repoB')).result.current).toBe('b')
  })
})
