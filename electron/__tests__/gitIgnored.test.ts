import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { getIgnoredPaths } from '../git'

const execFileAsync = promisify(execFile)

describe('getIgnoredPaths', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'git-ignored-'))
    await execFileAsync('git', ['init', '-q'], { cwd: root })
    await writeFile(join(root, '.gitignore'), 'node_modules/\n*.log\n')
    await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'pkg', 'index.js'), '')
    await writeFile(join(root, 'debug.log'), '')
    await writeFile(join(root, 'tracked.ts'), 'export {}\n')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('lists ignored files and collapses ignored directories to a single entry', async () => {
    const ignored = await getIgnoredPaths(root)
    expect(ignored.sort()).toEqual(['debug.log', 'node_modules'].sort())
  })

  it('does not list tracked or non-ignored files', async () => {
    const ignored = await getIgnoredPaths(root)
    expect(ignored).not.toContain('tracked.ts')
  })

  it('returns an empty array for a non-git directory', async () => {
    const nonGitRoot = await mkdtemp(join(tmpdir(), 'not-a-git-repo-'))
    try {
      expect(await getIgnoredPaths(nonGitRoot)).toEqual([])
    } finally {
      await rm(nonGitRoot, { recursive: true, force: true })
    }
  })
})
