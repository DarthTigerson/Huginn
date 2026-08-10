import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { getBranchList } from '../git'

const execFileAsync = promisify(execFile)

describe('getBranchList', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'git-branch-list-'))
    await execFileAsync('git', ['init', '-q'], { cwd: root })
    await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: root })
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: root })
    await writeFile(join(root, 'a.txt'), 'a\n')
    await execFileAsync('git', ['add', 'a.txt'], { cwd: root })
    await execFileAsync('git', ['commit', '-q', '-m', 'init'], { cwd: root })
    await execFileAsync('git', ['branch', '-M', 'main'], { cwd: root })
    await execFileAsync('git', ['branch', 'feature-x'], { cwd: root })
    const { stdout: sha } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })
    // Fake remote-tracking refs directly — for-each-ref reads them the same
    // way it would after a real `git fetch`, no actual remote needed.
    await execFileAsync('git', ['update-ref', 'refs/remotes/origin/feat/remote-only', sha.trim()], { cwd: root })
    await execFileAsync('git', ['update-ref', 'refs/remotes/origin/feature-x', sha.trim()], { cwd: root })
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('reports the current branch', async () => {
    const { current } = await getBranchList(root)
    expect(current).toBe('main')
  })

  it('lists local branches', async () => {
    const { local } = await getBranchList(root)
    expect(local.sort()).toEqual(['feature-x', 'main'])
  })

  it('excludes remote branches that already have a local counterpart of the same short name', async () => {
    const { remote } = await getBranchList(root)
    expect(remote).not.toContain('origin/feature-x')
  })

  it('includes remote branches with no local counterpart', async () => {
    const { remote } = await getBranchList(root)
    expect(remote).toContain('origin/feat/remote-only')
  })

  it('returns empty lists and a null current branch for a non-git directory', async () => {
    const nonGitRoot = await mkdtemp(join(tmpdir(), 'not-a-git-repo-'))
    try {
      expect(await getBranchList(nonGitRoot)).toEqual({ current: null, local: [], remote: [] })
    } finally {
      await rm(nonGitRoot, { recursive: true, force: true })
    }
  })
})
