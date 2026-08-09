import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { listAllFiles, searchText, buildTree, readImageDataUrl } from '../fsOps'

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

  it('readImageDataUrl encodes file contents as a base64 data url with the right mime type', async () => {
    const pngPath = join(root, 'pixel.png')
    await writeFile(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const dataUrl = await readImageDataUrl(pngPath)
    expect(dataUrl).toBe('data:image/png;base64,iVBORw==')
  })

  it('readImageDataUrl falls back to octet-stream for unknown extensions', async () => {
    const path = join(root, 'mystery.xyz')
    await writeFile(path, Buffer.from([1, 2, 3]))
    const dataUrl = await readImageDataUrl(path)
    expect(dataUrl.startsWith('data:application/octet-stream;base64,')).toBe(true)
  })
})
