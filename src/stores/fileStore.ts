import { create } from 'zustand'
import type { FileNode } from '@/types/index'
import { useEditorStore } from './editorStore'

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

const LAST_ROOT_KEY = 'huginn:lastProjectRoot'

interface FileState {
  projectRoot: string | null
  tree: FileNode[]
  selectedPath: string | null
  restoreRoot: () => Promise<void>
  openFolder: () => Promise<void>
  refreshRoot: () => Promise<void>
  expandDir: (dirPath: string) => Promise<void>
  select: (path: string) => void
}

export const useFileStore = create<FileState>((set, get) => ({
  projectRoot: null,
  tree: [],
  selectedPath: null,

  restoreRoot: async () => {
    const lastRoot = localStorage.getItem(LAST_ROOT_KEY)
    if (!lastRoot) return
    try {
      const tree = await window.api.readDir(lastRoot)
      set({ projectRoot: lastRoot, tree })
    } catch {
      localStorage.removeItem(LAST_ROOT_KEY)
    }
  },

  refreshRoot: async () => {
    const { projectRoot } = get()
    if (!projectRoot) return
    const tree = await window.api.readDir(projectRoot)
    set({ tree })
  },

  openFolder: async () => {
    const root = await window.api.openFolder()
    if (!root) return
    const tree = await window.api.readDir(root)
    const previousRoot = get().projectRoot
    localStorage.setItem(LAST_ROOT_KEY, root)
    set({ projectRoot: root, tree })
    // Every open tab (file/terminal/browser) points at the old repo — start
    // the new one clean rather than leaving them dangling around.
    if (previousRoot !== null && previousRoot !== root) {
      useEditorStore.getState().resetForNewProject()
    }
  },

  expandDir: async (dirPath: string) => {
    const children = await window.api.readDir(dirPath)
    set((state) => ({
      tree: setNodeChildren(state.tree, dirPath, children),
    }))
  },

  select: (path: string) => set({ selectedPath: path }),
}))
