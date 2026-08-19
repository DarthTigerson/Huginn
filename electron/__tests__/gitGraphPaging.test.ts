import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { getGitGraph, getGitBranchDiff, GIT_LOG_PAGE_SIZE } from '../git'

const execFileAsync = promisify(execFile)

async function createEmptyCommits(root: string, count: number, prefix: string): Promise<void> {
  for (let i = 0; i < count; i++) {
    await execFileAsync('git', ['commit', '--allow-empty', '-q', '-m', `${prefix} ${i}`], { cwd: root })
  }
}

describe('getGitGraph paging', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'git-graph-paging-'))
    await execFileAsync('git', ['init', '-q'], { cwd: root })
    await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: root })
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: root })
    await execFileAsync('git', ['commit', '--allow-empty', '-q', '-m', 'init'], { cwd: root })
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('with no offset, returns the newest commits first', async () => {
    await createEmptyCommits(root, 4, 'commit')
    const commits = await getGitGraph(root)
    expect(commits.map((c) => c.subject)).toEqual(['commit 3', 'commit 2', 'commit 1', 'commit 0', 'init'])
  })

  it('a non-zero offset skips that many of the newest commits', async () => {
    await createEmptyCommits(root, 4, 'commit')
    const fromOffset = await getGitGraph(root, 2)
    expect(fromOffset.map((c) => c.subject)).toEqual(['commit 1', 'commit 0', 'init'])
  })

  it('an explicit limit overrides GIT_LOG_PAGE_SIZE, for the wide search fetch', async () => {
    await createEmptyCommits(root, 4, 'commit')
    const wide = await getGitGraph(root, 0, 2)
    expect(wide.map((c) => c.subject)).toEqual(['commit 3', 'commit 2'])
  })

  it(
    'caps a page at GIT_LOG_PAGE_SIZE, and an offset of the previous page length continues from there',
    async () => {
      // +5 extra commits on top of the 'init' commit from beforeEach.
      await createEmptyCommits(root, GIT_LOG_PAGE_SIZE + 5, 'commit')

      const firstPage = await getGitGraph(root)
      expect(firstPage).toHaveLength(GIT_LOG_PAGE_SIZE)

      const secondPage = await getGitGraph(root, firstPage.length)
      expect(secondPage).toHaveLength(6)
      expect(secondPage[secondPage.length - 1].subject).toBe('init')
    },
    45000
  )
})

describe('getGitBranchDiff paging', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'git-branchdiff-paging-'))
    await execFileAsync('git', ['init', '-q', '-b', 'base'], { cwd: root })
    await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: root })
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: root })
    await execFileAsync('git', ['commit', '--allow-empty', '-q', '-m', 'base commit'], { cwd: root })
    await execFileAsync('git', ['checkout', '-q', '-b', 'feature'], { cwd: root })
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('with no offset, returns feature..base commits newest first', async () => {
    await createEmptyCommits(root, 4, 'feature commit')
    const { commits } = await getGitBranchDiff(root, 'feature', 'base')
    expect(commits.map((c) => c.subject)).toEqual(['feature commit 3', 'feature commit 2', 'feature commit 1', 'feature commit 0'])
  })

  it('a non-zero offset skips that many of the newest commits', async () => {
    await createEmptyCommits(root, 4, 'feature commit')
    const { commits } = await getGitBranchDiff(root, 'feature', 'base', 2)
    expect(commits.map((c) => c.subject)).toEqual(['feature commit 1', 'feature commit 0'])
  })

  it('an explicit limit overrides GIT_LOG_PAGE_SIZE, for the wide search fetch', async () => {
    await createEmptyCommits(root, 4, 'feature commit')
    const { commits } = await getGitBranchDiff(root, 'feature', 'base', 0, 2)
    expect(commits.map((c) => c.subject)).toEqual(['feature commit 3', 'feature commit 2'])
  })

  it(
    'caps a page at GIT_LOG_PAGE_SIZE, and an offset of the previous page length continues from there',
    async () => {
      await createEmptyCommits(root, GIT_LOG_PAGE_SIZE + 5, 'feature commit')

      const firstPage = await getGitBranchDiff(root, 'feature', 'base')
      expect(firstPage.commits).toHaveLength(GIT_LOG_PAGE_SIZE)

      const secondPage = await getGitBranchDiff(root, 'feature', 'base', firstPage.commits.length)
      expect(secondPage.commits).toHaveLength(5)
      expect(secondPage.commits[secondPage.commits.length - 1].subject).toBe('feature commit 0')
    },
    45000
  )
})
