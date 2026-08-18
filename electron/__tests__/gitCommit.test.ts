import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, writeFile, chmod, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { commit } from '../git'

const execFileAsync = promisify(execFile)

describe('commit', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'git-commit-'))
    await execFileAsync('git', ['init', '-q'], { cwd: root })
    await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: root })
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: root })
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function installFailingPreCommitHook() {
    const hookPath = join(root, '.git', 'hooks', 'pre-commit')
    await writeFile(hookPath, '#!/bin/sh\nexit 1\n')
    await chmod(hookPath, 0o755)
  }

  it('commits staged changes with the given message', async () => {
    await writeFile(join(root, 'a.txt'), 'hello\n')
    await execFileAsync('git', ['add', 'a.txt'], { cwd: root })

    const result = await commit(root, 'add a.txt')

    expect(result).toEqual({ ok: true })
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%s'], { cwd: root })
    expect(stdout.trim()).toBe('add a.txt')
  })

  it('fails when a pre-commit hook rejects it', async () => {
    await installFailingPreCommitHook()
    await writeFile(join(root, 'a.txt'), 'hello\n')
    await execFileAsync('git', ['add', 'a.txt'], { cwd: root })

    const result = await commit(root, 'add a.txt')

    expect(result.ok).toBe(false)
  })

  it('bypasses a failing pre-commit hook when noVerify is true', async () => {
    await installFailingPreCommitHook()
    await writeFile(join(root, 'a.txt'), 'hello\n')
    await execFileAsync('git', ['add', 'a.txt'], { cwd: root })

    const result = await commit(root, 'add a.txt', true)

    expect(result).toEqual({ ok: true })
  })
})
