import { create } from 'zustand'

interface GitBranchStore {
  current: string | null
  local: string[]
  remote: string[]
  loading: boolean
  load: (cwd: string) => Promise<void>
}

export const useGitBranchStore = create<GitBranchStore>((set) => ({
  current: null,
  local: [],
  remote: [],
  loading: false,

  load: async (cwd) => {
    set({ loading: true })
    const { current, local, remote } = await window.api.gitBranchList(cwd)
    set({ current, local, remote, loading: false })
  },
}))
