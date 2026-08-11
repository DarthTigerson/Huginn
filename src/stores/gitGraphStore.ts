import { create } from 'zustand'
import type { GitCommit } from '@/types/index'

interface GitGraphStore {
  commits: GitCommit[]
  selectedHash: string | null
  loading: boolean
  load: (cwd: string) => Promise<void>
  select: (hash: string | null) => void
}

export const useGitGraphStore = create<GitGraphStore>((set) => ({
  commits: [],
  selectedHash: null,
  loading: false,

  load: async (cwd) => {
    set({ loading: true })
    const commits = await window.api.gitGraph(cwd)
    set({ commits, loading: false })
  },

  select: (hash) => set({ selectedHash: hash }),
}))
