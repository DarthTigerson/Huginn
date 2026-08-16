import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { discoverRepos } from '../git'

const execFileAsync = promisify(execFile)

async function initRepo(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  await execFileAsync('git', ['init', '-q'], { cwd: dir })
}

describe('discoverRepos', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'discover-repos-'))
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns just the root when the opened folder itself is a repo', async () => {
    const single = join(root, 'single-repo-case')
    await initRepo(single)
    expect(await discoverRepos(single)).toEqual([single])
  })

  it('scans immediate children and returns the ones with .git, sorted', async () => {
    const parent = join(root, 'parent-case')
    await mkdir(parent, { recursive: true })
    await initRepo(join(parent, 'repoB'))
    await initRepo(join(parent, 'repoA'))
    await mkdir(join(parent, 'not-a-repo'), { recursive: true })
    await writeFile(join(parent, 'README.md'), 'hello\n')

    expect(await discoverRepos(parent)).toEqual([
      join(parent, 'repoA'),
      join(parent, 'repoB'),
    ])
  })

  it('does not recurse into grandchildren', async () => {
    const parent = join(root, 'no-recurse-case')
    await mkdir(join(parent, 'level1', 'level2'), { recursive: true })
    await initRepo(join(parent, 'level1', 'level2'))

    expect(await discoverRepos(parent)).toEqual([])
  })

  it('returns an empty list when nothing under the folder is a repo', async () => {
    const parent = join(root, 'no-repos-case')
    await mkdir(join(parent, 'plain-dir'), { recursive: true })

    expect(await discoverRepos(parent)).toEqual([])
  })

  it('returns an empty list for a nonexistent root', async () => {
    expect(await discoverRepos(join(root, 'does-not-exist'))).toEqual([])
  })
})
