import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGitBranchStore } from '../gitBranchStore'
import type { GitBranchList } from '@/types/index'

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
    useGitBranchStore.setState({ current: null, local: [], remote: [], loading: false })
  })

  it('starts empty', () => {
    const { current, local, remote, loading } = useGitBranchStore.getState()
    expect(current).toBeNull()
    expect(local).toEqual([])
    expect(remote).toEqual([])
    expect(loading).toBe(false)
  })

  it('load sets loading while in flight and populates state on success', async () => {
    const loadPromise = useGitBranchStore.getState().load('/proj')
    expect(useGitBranchStore.getState().loading).toBe(true)
    await loadPromise
    const { current, local, remote, loading } = useGitBranchStore.getState()
    expect(window.api.gitBranchList).toHaveBeenCalledWith('/proj')
    expect(current).toBe('main')
    expect(local).toEqual(['main', 'feature-x'])
    expect(remote).toEqual(['origin/feat/remote-only'])
    expect(loading).toBe(false)
  })
})
