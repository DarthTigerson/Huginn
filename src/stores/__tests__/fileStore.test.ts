import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFileStore } from '../fileStore'
import type { FileNode } from '@/types/index'

const mockTree: FileNode[] = [
  { name: 'src', path: '/proj/src', isDirectory: true },
  { name: 'package.json', path: '/proj/package.json', isDirectory: false },
]

vi.stubGlobal('window', {
  api: {
    openFolder: vi.fn().mockResolvedValue('/proj'),
    readDir: vi.fn().mockResolvedValue(mockTree),
  },
})

describe('fileStore', () => {
  beforeEach(() =>
    useFileStore.setState({ projectRoot: null, tree: [], selectedPath: null })
  )

  it('starts empty', () => {
    const { projectRoot, tree, selectedPath } = useFileStore.getState()
    expect(projectRoot).toBeNull()
    expect(tree).toHaveLength(0)
    expect(selectedPath).toBeNull()
  })

  it('openFolder sets root and loads tree', async () => {
    await useFileStore.getState().openFolder()
    const { projectRoot, tree } = useFileStore.getState()
    expect(projectRoot).toBe('/proj')
    expect(tree).toEqual(mockTree)
  })

  it('openFolder does nothing if dialog is cancelled', async () => {
    vi.mocked(window.api.openFolder).mockResolvedValueOnce(null)
    await useFileStore.getState().openFolder()
    expect(useFileStore.getState().projectRoot).toBeNull()
  })

  it('expandDir updates the matching node children in the tree', async () => {
    useFileStore.setState({ tree: mockTree })
    const children: FileNode[] = [
      { name: 'App.tsx', path: '/proj/src/App.tsx', isDirectory: false },
    ]
    vi.mocked(window.api.readDir).mockResolvedValueOnce(children)
    await useFileStore.getState().expandDir('/proj/src')
    const srcNode = useFileStore.getState().tree.find((n) => n.path === '/proj/src')
    expect(srcNode?.children).toEqual(children)
  })

  it('select sets selectedPath', () => {
    useFileStore.getState().select('/proj/package.json')
    expect(useFileStore.getState().selectedPath).toBe('/proj/package.json')
  })
})
