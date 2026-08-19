import { describe, it, expect, beforeEach } from 'vitest'
import { useGitBranchDiffStore } from '../gitBranchDiffStore'
import { EMPTY_COMMIT_FILTERS } from '@/components/Git/commitFilter'
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
      loadingMore: false,
      hasMore: true,
      selectedHash: null,
      filters: EMPTY_COMMIT_FILTERS,
      wideFetched: false,
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

  it('setCommits sets hasMore true for a full page, false for a short one', () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => makeCommit(`h${i}`))
    useGitBranchDiffStore.getState().setCommits(fullPage)
    expect(useGitBranchDiffStore.getState().hasMore).toBe(true)

    useGitBranchDiffStore.getState().setCommits([makeCommit('only-one')])
    expect(useGitBranchDiffStore.getState().hasMore).toBe(false)
  })

  it('appendCommits adds to the existing list and recomputes hasMore off the new page alone', () => {
    useGitBranchDiffStore.setState({ commits: [makeCommit('a'), makeCommit('b')], loadingMore: true })
    useGitBranchDiffStore.getState().appendCommits([makeCommit('c')])
    expect(useGitBranchDiffStore.getState().commits.map((c) => c.hash)).toEqual(['a', 'b', 'c'])
    expect(useGitBranchDiffStore.getState().hasMore).toBe(false)
    expect(useGitBranchDiffStore.getState().loadingMore).toBe(false)
  })

  it('setLoadingMore toggles loadingMore', () => {
    useGitBranchDiffStore.getState().setLoadingMore(true)
    expect(useGitBranchDiffStore.getState().loadingMore).toBe(true)
    useGitBranchDiffStore.getState().setLoadingMore(false)
    expect(useGitBranchDiffStore.getState().loadingMore).toBe(false)
  })

  it('setFilters merges into the existing filters', () => {
    useGitBranchDiffStore.getState().setFilters({ searchText: 'fix' })
    useGitBranchDiffStore.getState().setFilters({ authors: ['Ada'] })
    expect(useGitBranchDiffStore.getState().filters).toEqual({
      searchText: 'fix',
      branches: [],
      tags: [],
      authors: ['Ada'],
    })
  })

  it('setWideFetched sets the flag', () => {
    useGitBranchDiffStore.getState().setWideFetched(true)
    expect(useGitBranchDiffStore.getState().wideFetched).toBe(true)
  })

  it('resetFilters clears filters and wideFetched back to defaults', () => {
    useGitBranchDiffStore.setState({
      filters: { searchText: 'x', branches: ['main'], tags: [], authors: [] },
      wideFetched: true,
    })
    useGitBranchDiffStore.getState().resetFilters()
    expect(useGitBranchDiffStore.getState().filters).toEqual(EMPTY_COMMIT_FILTERS)
    expect(useGitBranchDiffStore.getState().wideFetched).toBe(false)
  })
})
