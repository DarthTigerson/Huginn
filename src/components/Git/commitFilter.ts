import type { GitCommit } from '@/types/index'
import { parseRefTarget } from './commitFormat'

export interface CommitFilters {
  searchText: string
  branches: string[]
  tags: string[]
  authors: string[]
}

export const EMPTY_COMMIT_FILTERS: CommitFilters = {
  searchText: '',
  branches: [],
  tags: [],
  authors: [],
}

export function hasActiveFilters(filters: CommitFilters): boolean {
  return (
    filters.searchText.trim() !== '' ||
    filters.branches.length > 0 ||
    filters.tags.length > 0 ||
    filters.authors.length > 0
  )
}

function commitBranchNames(commit: GitCommit): string[] {
  return commit.refs
    .map(parseRefTarget)
    .filter((t): t is NonNullable<typeof t> => t !== null && t.kind !== 'tag')
    .map((t) => t.name)
}

function commitTagNames(commit: GitCommit): string[] {
  return commit.refs
    .map(parseRefTarget)
    .filter((t): t is NonNullable<typeof t> => t !== null && t.kind === 'tag')
    .map((t) => t.name)
}

export function distinctBranches(commits: GitCommit[]): string[] {
  return Array.from(new Set(commits.flatMap(commitBranchNames))).sort((a, b) => a.localeCompare(b))
}

export function distinctTags(commits: GitCommit[]): string[] {
  return Array.from(new Set(commits.flatMap(commitTagNames))).sort((a, b) => a.localeCompare(b))
}

export function distinctAuthors(commits: GitCommit[]): string[] {
  return Array.from(new Set(commits.map((c) => c.author))).sort((a, b) => a.localeCompare(b))
}

function matchesSearchText(commit: GitCommit, needle: string): boolean {
  if (!needle) return true
  return (
    commit.subject.toLowerCase().includes(needle) ||
    commit.hash.toLowerCase().includes(needle) ||
    commit.author.toLowerCase().includes(needle) ||
    commit.refs.some((ref) => ref.toLowerCase().includes(needle))
  )
}

export function filterCommits(commits: GitCommit[], filters: CommitFilters): GitCommit[] {
  if (!hasActiveFilters(filters)) return commits
  const needle = filters.searchText.trim().toLowerCase()

  return commits.filter((commit) => {
    if (!matchesSearchText(commit, needle)) return false
    if (filters.branches.length > 0 && !commitBranchNames(commit).some((b) => filters.branches.includes(b))) {
      return false
    }
    if (filters.tags.length > 0 && !commitTagNames(commit).some((t) => filters.tags.includes(t))) {
      return false
    }
    if (filters.authors.length > 0 && !filters.authors.includes(commit.author)) {
      return false
    }
    return true
  })
}
