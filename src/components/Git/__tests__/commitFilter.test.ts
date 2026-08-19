import { describe, it, expect } from 'vitest'
import {
  EMPTY_COMMIT_FILTERS,
  hasActiveFilters,
  distinctBranches,
  distinctTags,
  distinctAuthors,
  filterCommits,
} from '../commitFilter'
import type { GitCommit } from '@/types/index'

function commit(overrides: Partial<GitCommit>): GitCommit {
  return {
    hash: 'abc1234',
    parents: [],
    subject: 'Fix bug',
    author: 'Ada',
    date: '2026-01-01T00:00:00Z',
    refs: [],
    ...overrides,
  }
}

const fixBug = commit({ hash: 'aaa1111', subject: 'Fix login bug', author: 'Ada', refs: ['HEAD -> main', 'main'] })
const addFeature = commit({ hash: 'bbb2222', subject: 'Add dark mode', author: 'Grace', refs: ['origin/feature-x'] })
const release = commit({ hash: 'ccc3333', subject: 'Release v1.0', author: 'Ada', refs: ['tag: v1.0'] })
const untouched = commit({ hash: 'ddd4444', subject: 'Update deps', author: 'Linus', refs: [] })
const all = [fixBug, addFeature, release, untouched]

describe('hasActiveFilters', () => {
  it('is false for EMPTY_COMMIT_FILTERS', () => {
    expect(hasActiveFilters(EMPTY_COMMIT_FILTERS)).toBe(false)
  })

  it('is false for whitespace-only search text', () => {
    expect(hasActiveFilters({ ...EMPTY_COMMIT_FILTERS, searchText: '   ' })).toBe(false)
  })

  it('is true when any filter dimension is non-empty', () => {
    expect(hasActiveFilters({ ...EMPTY_COMMIT_FILTERS, searchText: 'x' })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_COMMIT_FILTERS, branches: ['main'] })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_COMMIT_FILTERS, tags: ['v1.0'] })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_COMMIT_FILTERS, authors: ['Ada'] })).toBe(true)
  })
})

describe('distinctBranches / distinctTags / distinctAuthors', () => {
  it('derives sorted unique branch names, excluding tags', () => {
    expect(distinctBranches(all)).toEqual(['feature-x', 'main'])
  })

  it('derives sorted unique tag names', () => {
    expect(distinctTags(all)).toEqual(['v1.0'])
  })

  it('derives sorted unique author names', () => {
    expect(distinctAuthors(all)).toEqual(['Ada', 'Grace', 'Linus'])
  })
})

describe('filterCommits', () => {
  it('returns everything unfiltered when no filters are active', () => {
    expect(filterCommits(all, EMPTY_COMMIT_FILTERS)).toEqual(all)
  })

  it('search text matches the subject, case-insensitively', () => {
    const result = filterCommits(all, { ...EMPTY_COMMIT_FILTERS, searchText: 'DARK' })
    expect(result).toEqual([addFeature])
  })

  it('search text matches the commit hash', () => {
    const result = filterCommits(all, { ...EMPTY_COMMIT_FILTERS, searchText: 'ccc3333' })
    expect(result).toEqual([release])
  })

  it('search text matches the author', () => {
    const result = filterCommits(all, { ...EMPTY_COMMIT_FILTERS, searchText: 'grace' })
    expect(result).toEqual([addFeature])
  })

  it('search text matches ref names', () => {
    const result = filterCommits(all, { ...EMPTY_COMMIT_FILTERS, searchText: 'feature-x' })
    expect(result).toEqual([addFeature])
  })

  it('branch filter keeps only commits reachable from a selected branch ref', () => {
    const result = filterCommits(all, { ...EMPTY_COMMIT_FILTERS, branches: ['feature-x'] })
    expect(result).toEqual([addFeature])
  })

  it('tag filter keeps only commits carrying a selected tag', () => {
    const result = filterCommits(all, { ...EMPTY_COMMIT_FILTERS, tags: ['v1.0'] })
    expect(result).toEqual([release])
  })

  it('author filter keeps only commits by a selected author', () => {
    const result = filterCommits(all, { ...EMPTY_COMMIT_FILTERS, authors: ['Ada'] })
    expect(result).toEqual([fixBug, release])
  })

  it('combines multiple filter dimensions with AND', () => {
    const result = filterCommits(all, { ...EMPTY_COMMIT_FILTERS, authors: ['Ada'], searchText: 'release' })
    expect(result).toEqual([release])
  })

  it('an author with no matching commits after other filters narrows to empty', () => {
    const result = filterCommits(all, { ...EMPTY_COMMIT_FILTERS, authors: ['Linus'], tags: ['v1.0'] })
    expect(result).toEqual([])
  })
})
