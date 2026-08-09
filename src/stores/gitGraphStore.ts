import { create } from 'zustand'
import type { GitCommit } from '@/types/index'

interface GitGraphStore {
  commits: GitCommit[]
  selectedHash: string | null
  loading: boolean
  selectedFiles: string[]
  filesLoading: boolean
  load: (cwd: string) => Promise<void>
  select: (hash: string | null) => void
  loadFiles: (cwd: string, hash: string) => Promise<void>
}

export const useGitGraphStore = create<GitGraphStore>((set) => ({
  commits: [],
  selectedHash: null,
  loading: false,
  selectedFiles: [],
  filesLoading: false,

  load: async (cwd) => {
    set({ loading: true })
    const commits = await window.api.gitGraph(cwd)
    set({ commits, loading: false })
  },

  select: (hash) => set({ selectedHash: hash, selectedFiles: [] }),

  loadFiles: async (cwd, hash) => {
    set({ filesLoading: true })
    const files = await window.api.gitShowStat(cwd, hash)
    set({ selectedFiles: files, filesLoading: false })
  },
}))
