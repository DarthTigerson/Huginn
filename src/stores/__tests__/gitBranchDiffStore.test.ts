import { describe, it, expect, beforeEach } from 'vitest'
import { useGitBranchDiffStore } from '../gitBranchDiffStore'
import type { GitCommit } from '@/types/index'

function makeCommit(hash: string): GitCommit {
  return { hash, subject: 'msg', author: 'a', date: '2026-01-01T00:00:00Z', parents: [], refs: [] }
}

describe('gitBranchDiffStore', () => {
  beforeEach(() => {
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

  it('setSourceIfEmpty sets the value when empty', () => {
    useGitBranchDiffStore.getState().setSourceIfEmpty('main')
    expect(useGitBranchDiffStore.getState().source).toBe('main')
  })

  it('setSourceIfEmpty does not overwrite an already-set value', () => {
    useGitBranchDiffStore.setState({ source: 'feature-x' })
    useGitBranchDiffStore.getState().setSourceIfEmpty('main')
    expect(useGitBranchDiffStore.getState().source).toBe('feature-x')
  })

  it('setTargetIfEmpty does not overwrite an already-set value', () => {
    useGitBranchDiffStore.setState({ target: 'develop' })
    useGitBranchDiffStore.getState().setTargetIfEmpty('main')
    expect(useGitBranchDiffStore.getState().target).toBe('develop')
  })

  it('select sets and clears selectedHash', () => {
    useGitBranchDiffStore.getState().select('abc')
    expect(useGitBranchDiffStore.getState().selectedHash).toBe('abc')
    useGitBranchDiffStore.getState().select(null)
    expect(useGitBranchDiffStore.getState().selectedHash).toBeNull()
  })

  it('setCommits keeps the current selection when it is still present in the new list', () => {
    useGitBranchDiffStore.setState({ selectedHash: 'abc' })
    useGitBranchDiffStore.getState().setCommits([makeCommit('abc'), makeCommit('def')])
    expect(useGitBranchDiffStore.getState().selectedHash).toBe('abc')
  })

  it('setCommits clears the selection when it is no longer present in the new list', () => {
    useGitBranchDiffStore.setState({ selectedHash: 'abc' })
    useGitBranchDiffStore.getState().setCommits([makeCommit('def'), makeCommit('ghi')])
    expect(useGitBranchDiffStore.getState().selectedHash).toBeNull()
  })

  it('setCommits with an empty list clears the selection', () => {
    useGitBranchDiffStore.setState({ selectedHash: 'abc' })
    useGitBranchDiffStore.getState().setCommits([])
    expect(useGitBranchDiffStore.getState().selectedHash).toBeNull()
  })

  it('setCommits with no prior selection stays null', () => {
    useGitBranchDiffStore.getState().setCommits([makeCommit('abc')])
    expect(useGitBranchDiffStore.getState().selectedHash).toBeNull()
  })
})
