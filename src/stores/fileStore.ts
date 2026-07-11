import { create } from 'zustand'
import type { FileNode } from '@/types/index'

function setNodeChildren(
  nodes: FileNode[],
  targetPath: string,
  children: FileNode[]
): FileNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) return { ...node, children }
    if (node.isDirectory && node.children) {
      return { ...node, children: setNodeChildren(node.children, targetPath, children) }
    }
    return node
  })
}

interface FileState {
  projectRoot: string | null
  tree: FileNode[]
  selectedPath: string | null
  openFolder: () => Promise<void>
  expandDir: (dirPath: string) => Promise<void>
  select: (path: string) => void
}

export const useFileStore = create<FileState>((set, get) => ({
  projectRoot: null,
  tree: [],
  selectedPath: null,

  openFolder: async () => {
    const root = await window.api.openFolder()
    if (!root) return
    const tree = await window.api.readDir(root)
    set({ projectRoot: root, tree })
  },

  expandDir: async (dirPath: string) => {
    const children = await window.api.readDir(dirPath)
    set((state) => ({
      tree: setNodeChildren(state.tree, dirPath, children),
    }))
  },

  select: (path: string) => set({ selectedPath: path }),
}))
