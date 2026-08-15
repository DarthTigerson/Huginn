import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { getStagedDiff } from '../git'

const execFileAsync = promisify(execFile)

describe('getStagedDiff', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'git-staged-diff-'))
    await execFileAsync('git', ['init', '-q'], { cwd: root })
    await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: root })
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: root })
    await writeFile(join(root, 'tracked.txt'), 'original\n')
    await execFileAsync('git', ['add', 'tracked.txt'], { cwd: root })
    await execFileAsync('git', ['commit', '-q', '-m', 'init'], { cwd: root })
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns an empty string when nothing is staged', async () => {
    expect(await getStagedDiff(root)).toBe('')
  })

  it('returns the unified diff for a staged modification', async () => {
    await writeFile(join(root, 'tracked.txt'), 'edited\n')
    await execFileAsync('git', ['add', 'tracked.txt'], { cwd: root })

    const diff = await getStagedDiff(root)

    expect(diff).toContain('tracked.txt')
    expect(diff).toContain('-original')
    expect(diff).toContain('+edited')
  })

  it('does not include unstaged changes', async () => {
    await writeFile(join(root, 'tracked.txt'), 'edited\n')
    await execFileAsync('git', ['add', 'tracked.txt'], { cwd: root })
    await writeFile(join(root, 'tracked.txt'), 'edited further\n')

    const diff = await getStagedDiff(root)

    expect(diff).toContain('+edited\n')
    expect(diff).not.toContain('edited further')
  })

  it('includes a staged new file', async () => {
    await writeFile(join(root, 'new.txt'), 'brand new\n')
    await execFileAsync('git', ['add', 'new.txt'], { cwd: root })

    const diff = await getStagedDiff(root)

    expect(diff).toContain('new.txt')
    expect(diff).toContain('+brand new')
  })
})
