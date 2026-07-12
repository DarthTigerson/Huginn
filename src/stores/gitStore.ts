import { create } from 'zustand'

interface GitStore {
  branch: string | null
  refresh: (cwd: string | null) => Promise<void>
}

export const useGitStore = create<GitStore>((set) => ({
  branch: null,
  refresh: async (cwd) => {
    if (!cwd) return set({ branch: null })
    const branch = await window.api.gitBranch(cwd)
    set({ branch })
  },
}))
