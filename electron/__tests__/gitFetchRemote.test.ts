import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { fetchRemote } from '../git'

const execFileAsync = promisify(execFile)

describe('fetchRemote', () => {
  let remoteRoot: string
  let localRoot: string

  beforeAll(async () => {
    remoteRoot = await mkdtemp(join(tmpdir(), 'git-fetch-remote-'))
    await execFileAsync('git', ['init', '-q', '--bare'], { cwd: remoteRoot })

    const seedRoot = await mkdtemp(join(tmpdir(), 'git-fetch-seed-'))
    await execFileAsync('git', ['init', '-q'], { cwd: seedRoot })
    await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: seedRoot })
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: seedRoot })
    await writeFile(join(seedRoot, 'a.txt'), 'a\n')
    await execFileAsync('git', ['add', 'a.txt'], { cwd: seedRoot })
    await execFileAsync('git', ['commit', '-q', '-m', 'init'], { cwd: seedRoot })
    await execFileAsync('git', ['branch', '-M', 'main'], { cwd: seedRoot })
    await execFileAsync('git', ['remote', 'add', 'origin', remoteRoot], { cwd: seedRoot })
    await execFileAsync('git', ['push', '-q', 'origin', 'main'], { cwd: seedRoot })

    localRoot = await mkdtemp(join(tmpdir(), 'git-fetch-local-'))
    await execFileAsync('git', ['clone', '-q', remoteRoot, localRoot])

    // A new commit lands on the remote after the clone — this is what a
    // real fetch is supposed to pull down.
    await writeFile(join(seedRoot, 'b.txt'), 'b\n')
    await execFileAsync('git', ['add', 'b.txt'], { cwd: seedRoot })
    await execFileAsync('git', ['commit', '-q', '-m', 'second'], { cwd: seedRoot })
    await execFileAsync('git', ['push', '-q', 'origin', 'main'], { cwd: seedRoot })
    await rm(seedRoot, { recursive: true, force: true })
  })

  afterAll(async () => {
    await rm(remoteRoot, { recursive: true, force: true })
    await rm(localRoot, { recursive: true, force: true })
  })

  it('returns true and updates remote-tracking refs on success', async () => {
    const { stdout: before } = await execFileAsync('git', ['rev-parse', 'origin/main'], { cwd: localRoot })

    expect(await fetchRemote(localRoot)).toBe(true)

    const { stdout: after } = await execFileAsync('git', ['rev-parse', 'origin/main'], { cwd: localRoot })
    expect(after.trim()).not.toBe(before.trim())
  })

  it('returns true (no-op) for a repo with no origin remote — `git fetch` with zero remotes configured exits 0', async () => {
    const noRemoteRoot = await mkdtemp(join(tmpdir(), 'git-fetch-none-'))
    try {
      await execFileAsync('git', ['init', '-q'], { cwd: noRemoteRoot })
      expect(await fetchRemote(noRemoteRoot)).toBe(true)
    } finally {
      await rm(noRemoteRoot, { recursive: true, force: true })
    }
  })

  it('returns false when the remote is unreachable', async () => {
    const unreachableRoot = await mkdtemp(join(tmpdir(), 'git-fetch-unreachable-'))
    try {
      await execFileAsync('git', ['clone', '-q', remoteRoot, unreachableRoot])
      await execFileAsync(
        'git',
        ['remote', 'set-url', 'origin', '/no/such/path/on/this/machine'],
        { cwd: unreachableRoot }
      )
      expect(await fetchRemote(unreachableRoot)).toBe(false)
    } finally {
      await rm(unreachableRoot, { recursive: true, force: true })
    }
  })
})
