import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { listAllFiles, searchText, buildTree } from '../fsOps'

describe('fsOps', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'fsops-'))
    await mkdir(join(root, 'sub'))
    await writeFile(join(root, 'a.txt'), 'hello world\nfoo bar\n')
    await writeFile(join(root, 'sub', 'b.txt'), 'HELLO again\n')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('listAllFiles recurses into subdirectories', async () => {
    const files = await listAllFiles(root)
    expect(files.sort()).toEqual([join(root, 'a.txt'), join(root, 'sub', 'b.txt')].sort())
  })

  it('searchText finds case-sensitive matches with line/col', async () => {
    const matches = await searchText(root, 'hello', true)
    expect(matches.length).toBe(1)
    expect(matches[0].path).toBe(join(root, 'a.txt'))
    expect(matches[0].line).toBe(1)
    expect(matches[0].col).toBe(1)
  })

  it('searchText is case-insensitive when caseSensitive is false', async () => {
    const matches = await searchText(root, 'hello', false)
    expect(matches.length).toBe(2)
  })

  it('buildTree lists a single directory level, directories first, sorted', async () => {
    const tree = await buildTree(root)
    expect(tree.map((n) => n.name)).toEqual(['sub', 'a.txt'])
    expect(tree[0].isDirectory).toBe(true)
    expect(tree[1].isDirectory).toBe(false)
  })
})
