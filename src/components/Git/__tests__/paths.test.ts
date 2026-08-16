import { describe, it, expect } from 'vitest'
import { isGitDiffTab, buildGitDiffPath, parseGitDiffPath, isGitCommitDiffTab, buildGitCommitDiffPath, parseGitCommitDiffPath } from '../paths'
import { GIT_BRANCH_DIFF_TAB_PATH, isGitBranchDiffTab } from '@/components/Settings/paths'

describe('git diff virtual tab paths', () => {
  it('builds a staged diff path with the repo root folded in', () => {
    expect(buildGitDiffPath('/proj/repoA', 'src/foo.ts', true)).toBe(
      'git-diff://staged//proj/repoA\0src/foo.ts'
    )
  })

  it('builds an unstaged diff path with the repo root folded in', () => {
    expect(buildGitDiffPath('/proj/repoA', 'src/foo.ts', false)).toBe(
      'git-diff://unstaged//proj/repoA\0src/foo.ts'
    )
  })

  it('recognizes staged and unstaged diff tabs', () => {
    expect(isGitDiffTab(buildGitDiffPath('/proj/repoA', 'src/foo.ts', true))).toBe(true)
    expect(isGitDiffTab(buildGitDiffPath('/proj/repoA', 'src/foo.ts', false))).toBe(true)
  })

  it('does not treat regular file paths or settings tabs as diff tabs', () => {
    expect(isGitDiffTab('/proj/src/foo.ts')).toBe(false)
    expect(isGitDiffTab('settings://Display')).toBe(false)
  })

  it('parses a staged diff path back into repo root, file path, and staged flag', () => {
    expect(parseGitDiffPath(buildGitDiffPath('/proj/repoA', 'src/foo.ts', true))).toEqual({
      repoRoot: '/proj/repoA',
      path: 'src/foo.ts',
      staged: true,
    })
  })

  it('two repos with the same relative path produce different tab paths', () => {
    const a = buildGitDiffPath('/proj/repoA', 'src/foo.ts', true)
    const b = buildGitDiffPath('/proj/repoB', 'src/foo.ts', true)
    expect(a).not.toBe(b)
  })

  it('round-trips build -> parse', () => {
    const built = buildGitDiffPath('/proj/repoA', 'src/foo.ts', true)
    expect(parseGitDiffPath(built)).toEqual({ repoRoot: '/proj/repoA', path: 'src/foo.ts', staged: true })
  })

  it('recognizes the branch diff virtual tab', () => {
    expect(isGitBranchDiffTab(GIT_BRANCH_DIFF_TAB_PATH)).toBe(true)
    expect(isGitBranchDiffTab('git-graph://Graph')).toBe(false)
  })
})

describe('git commit diff virtual tab paths', () => {
  it('builds a commit diff path from a repo root, hash, and repo-relative file path', () => {
    expect(buildGitCommitDiffPath('/proj/repoA', 'abc123', 'src/foo.ts')).toBe(
      'git-commit-diff:///proj/repoA\0abc123/src/foo.ts'
    )
  })

  it('recognizes commit diff tabs and rejects other kinds', () => {
    const built = buildGitCommitDiffPath('/proj/repoA', 'abc123', 'src/foo.ts')
    expect(isGitCommitDiffTab(built)).toBe(true)
    expect(isGitCommitDiffTab(buildGitDiffPath('/proj/repoA', 'src/foo.ts', true))).toBe(false)
    expect(isGitCommitDiffTab('/proj/src/foo.ts')).toBe(false)
  })

  it('parses a commit diff path back into repo root, hash, and file path', () => {
    const built = buildGitCommitDiffPath('/proj/repoA', 'abc123', 'src/foo.ts')
    expect(parseGitCommitDiffPath(built)).toEqual({
      repoRoot: '/proj/repoA',
      hash: 'abc123',
      path: 'src/foo.ts',
    })
  })

  it('parses a nested file path correctly', () => {
    const built = buildGitCommitDiffPath('/proj/repoA', 'abc123', 'src/nested/dir/foo.ts')
    expect(parseGitCommitDiffPath(built)).toEqual({
      repoRoot: '/proj/repoA',
      hash: 'abc123',
      path: 'src/nested/dir/foo.ts',
    })
  })

  it('round-trips build -> parse', () => {
    const built = buildGitCommitDiffPath('/proj/repoA', 'deadbeef', 'src/a/b/c.ts')
    expect(parseGitCommitDiffPath(built)).toEqual({ repoRoot: '/proj/repoA', hash: 'deadbeef', path: 'src/a/b/c.ts' })
  })
})
