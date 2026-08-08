import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFileStore } from '../fileStore'
import { useEditorStore } from '../editorStore'
import type { FileNode } from '@/types/index'

const mockTree: FileNode[] = [
  { name: 'src', path: '/proj/src', isDirectory: true },
  { name: 'package.json', path: '/proj/package.json', isDirectory: false },
]

const { localStorageStore } = vi.hoisted(() => {
  const localStorageStore: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => localStorageStore[k] ?? null,
    setItem: (k: string, v: string) => { localStorageStore[k] = v },
    removeItem: (k: string) => { delete localStorageStore[k] },
  }
  return { localStorageStore }
})

vi.stubGlobal('window', {
  api: {
    openFolder: vi.fn().mockResolvedValue('/proj'),
    readDir: vi.fn().mockResolvedValue(mockTree),
    gitWatchRoot: vi.fn(),
  },
})

describe('fileStore', () => {
  beforeEach(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k])
    useFileStore.setState({ projectRoot: null, tree: [], selectedPath: null })
    useEditorStore.getState().resetForNewProject()
  })

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

  it('openFolder closes tabs left over from the previous project', async () => {
    await useFileStore.getState().openFolder()
    useEditorStore.getState().openTab({ path: '/proj/a.ts', content: '', dirty: false })
    expect(useEditorStore.getState().tabs).toHaveLength(1)

    vi.mocked(window.api.openFolder).mockResolvedValueOnce('/other-proj')
    vi.mocked(window.api.readDir).mockResolvedValueOnce([])
    await useFileStore.getState().openFolder()

    expect(useFileStore.getState().projectRoot).toBe('/other-proj')
    expect(useEditorStore.getState().tabs).toHaveLength(0)
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

  it('openProjectAt sets root and tree from the given path without opening a picker dialog', async () => {
    vi.mocked(window.api.readDir).mockResolvedValueOnce(mockTree)
    await useFileStore.getState().openProjectAt('/other-proj')
    const { projectRoot, tree } = useFileStore.getState()
    expect(projectRoot).toBe('/other-proj')
    expect(tree).toEqual(mockTree)
    expect(window.api.gitWatchRoot).toHaveBeenCalledWith('/other-proj')
  })

  it('openProjectAt does not write to localStorage (each window keeps its own project)', async () => {
    vi.mocked(window.api.readDir).mockResolvedValueOnce(mockTree)
    await useFileStore.getState().openProjectAt('/other-proj')
    expect(localStorage.getItem('huginn:lastProjectRoot')).toBeNull()
  })
})
