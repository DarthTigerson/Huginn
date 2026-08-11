import { describe, it, expect } from 'vitest'
import { isGitDiffTab, buildGitDiffPath, parseGitDiffPath, isGitCommitDiffTab, buildGitCommitDiffPath, parseGitCommitDiffPath } from '../paths'
import { GIT_BRANCH_DIFF_TAB_PATH, isGitBranchDiffTab } from '@/components/Settings/paths'

describe('git diff virtual tab paths', () => {
  it('builds a staged diff path', () => {
    expect(buildGitDiffPath('/proj/src/foo.ts', true)).toBe(
      'git-diff://staged//proj/src/foo.ts'
    )
  })

  it('builds an unstaged diff path', () => {
    expect(buildGitDiffPath('/proj/src/foo.ts', false)).toBe(
      'git-diff://unstaged//proj/src/foo.ts'
    )
  })

  it('recognizes staged and unstaged diff tabs', () => {
    expect(isGitDiffTab('git-diff://staged//proj/src/foo.ts')).toBe(true)
    expect(isGitDiffTab('git-diff://unstaged//proj/src/foo.ts')).toBe(true)
  })

  it('does not treat regular file paths or settings tabs as diff tabs', () => {
    expect(isGitDiffTab('/proj/src/foo.ts')).toBe(false)
    expect(isGitDiffTab('settings://Display')).toBe(false)
  })

  it('parses a staged diff path back into the real path and staged flag', () => {
    expect(parseGitDiffPath('git-diff://staged//proj/src/foo.ts')).toEqual({
      path: '/proj/src/foo.ts',
      staged: true,
    })
  })

  it('parses an unstaged diff path back into the real path and staged flag', () => {
    expect(parseGitDiffPath('git-diff://unstaged//proj/src/foo.ts')).toEqual({
      path: '/proj/src/foo.ts',
      staged: false,
    })
  })

  it('round-trips build -> parse', () => {
    const built = buildGitDiffPath('/proj/src/foo.ts', true)
    expect(parseGitDiffPath(built)).toEqual({ path: '/proj/src/foo.ts', staged: true })
  })

  it('recognizes the branch diff virtual tab', () => {
    expect(isGitBranchDiffTab(GIT_BRANCH_DIFF_TAB_PATH)).toBe(true)
    expect(isGitBranchDiffTab('git-graph://Graph')).toBe(false)
  })
})

describe('git commit diff virtual tab paths', () => {
  it('builds a commit diff path from a hash and a repo-relative file path', () => {
    expect(buildGitCommitDiffPath('abc123', 'src/foo.ts')).toBe(
      'git-commit-diff://abc123/src/foo.ts'
    )
  })

  it('recognizes commit diff tabs and rejects other kinds', () => {
    expect(isGitCommitDiffTab('git-commit-diff://abc123/src/foo.ts')).toBe(true)
    expect(isGitCommitDiffTab('git-diff://staged/src/foo.ts')).toBe(false)
    expect(isGitCommitDiffTab('/proj/src/foo.ts')).toBe(false)
  })

  it('parses a commit diff path back into the hash and file path', () => {
    expect(parseGitCommitDiffPath('git-commit-diff://abc123/src/foo.ts')).toEqual({
      hash: 'abc123',
      path: 'src/foo.ts',
    })
  })

  it('parses a nested file path correctly, splitting only on the first slash after the hash', () => {
    expect(parseGitCommitDiffPath('git-commit-diff://abc123/src/nested/dir/foo.ts')).toEqual({
      hash: 'abc123',
      path: 'src/nested/dir/foo.ts',
    })
  })

  it('round-trips build -> parse', () => {
    const built = buildGitCommitDiffPath('deadbeef', 'src/a/b/c.ts')
    expect(parseGitCommitDiffPath(built)).toEqual({ hash: 'deadbeef', path: 'src/a/b/c.ts' })
  })
})
