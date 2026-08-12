import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { getDefaultBranch } from '../git'

const execFileAsync = promisify(execFile)

describe('getDefaultBranch', () => {
  let remoteRoot: string
  let localRoot: string

  beforeAll(async () => {
    // A real bare "remote" repo (not a fake ref) so ls-remote has something
    // to actually query, and so its HEAD can be moved independently of
    // whatever the local clone cached at clone time.
    remoteRoot = await mkdtemp(join(tmpdir(), 'git-default-branch-remote-'))
    await execFileAsync('git', ['init', '-q', '--bare'], { cwd: remoteRoot })

    const seedRoot = await mkdtemp(join(tmpdir(), 'git-default-branch-seed-'))
    await execFileAsync('git', ['init', '-q'], { cwd: seedRoot })
    await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: seedRoot })
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: seedRoot })
    await writeFile(join(seedRoot, 'a.txt'), 'a\n')
    await execFileAsync('git', ['add', 'a.txt'], { cwd: seedRoot })
    await execFileAsync('git', ['commit', '-q', '-m', 'init'], { cwd: seedRoot })
    await execFileAsync('git', ['branch', '-M', 'master'], { cwd: seedRoot })
    await execFileAsync('git', ['remote', 'add', 'origin', remoteRoot], { cwd: seedRoot })
    await execFileAsync('git', ['push', '-q', 'origin', 'master'], { cwd: seedRoot })
    await execFileAsync('git', ['push', '-q', 'origin', 'master:main'], { cwd: seedRoot })
    await execFileAsync('git', ['symbolic-ref', 'HEAD', 'refs/heads/master'], { cwd: remoteRoot })
    await rm(seedRoot, { recursive: true, force: true })

    // Clone while the remote's default is still "master" — this is what
    // writes the local refs/remotes/origin/HEAD cache we're testing against.
    localRoot = await mkdtemp(join(tmpdir(), 'git-default-branch-local-'))
    await execFileAsync('git', ['clone', '-q', remoteRoot, localRoot])
  })

  afterAll(async () => {
    await rm(remoteRoot, { recursive: true, force: true })
    await rm(localRoot, { recursive: true, force: true })
  })

  it('returns the locally-cached default right after cloning', async () => {
    expect(await getDefaultBranch(localRoot)).toBe('origin/master')
  })

  it('picks up a default-branch change made on the remote after the clone, ignoring the stale local cache', async () => {
    // Simulate a GitLab/GitHub admin renaming the default branch — the
    // remote's HEAD moves, but the clone's local cache (checked in the
    // previous test) never gets touched by this.
    await execFileAsync('git', ['symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: remoteRoot })

    expect(await getDefaultBranch(localRoot)).toBe('origin/main')
  })

  it('falls back to the stale local cache when the remote is unreachable', async () => {
    const unreachableRoot = await mkdtemp(join(tmpdir(), 'git-default-branch-unreachable-'))
    try {
      await execFileAsync('git', ['clone', '-q', remoteRoot, unreachableRoot])
      await execFileAsync(
        'git',
        ['remote', 'set-url', 'origin', '/no/such/path/on/this/machine'],
        { cwd: unreachableRoot }
      )

      expect(await getDefaultBranch(unreachableRoot)).toBe('origin/main')
    } finally {
      await rm(unreachableRoot, { recursive: true, force: true })
    }
  })

  it('returns null for a repo with no origin remote and no cached HEAD', async () => {
    const noRemoteRoot = await mkdtemp(join(tmpdir(), 'git-default-branch-none-'))
    try {
      await execFileAsync('git', ['init', '-q'], { cwd: noRemoteRoot })
      expect(await getDefaultBranch(noRemoteRoot)).toBeNull()
    } finally {
      await rm(noRemoteRoot, { recursive: true, force: true })
    }
  })
})
