import { create } from 'zustand'

export interface RepoBranchState {
  current: string | null
  local: string[]
  remote: string[]
  loading: boolean
}

export const emptyRepoBranchState: RepoBranchState = {
  current: null,
  local: [],
  remote: [],
  loading: false,
}

interface GitBranchStore {
  repos: Record<string, RepoBranchState>
  load: (cwd: string) => Promise<void>
}

export const useGitBranchStore = create<GitBranchStore>((set) => ({
  repos: {},

  load: async (cwd) => {
    set((s) => ({ repos: { ...s.repos, [cwd]: { ...(s.repos[cwd] ?? emptyRepoBranchState), loading: true } } }))
    const { current, local, remote } = await window.api.gitBranchList(cwd)
    set((s) => ({ repos: { ...s.repos, [cwd]: { current, local, remote, loading: false } } }))
  },
}))

export function useRepoBranchState(cwd: string | null): RepoBranchState {
  return useGitBranchStore((s) => (cwd ? s.repos[cwd] ?? emptyRepoBranchState : emptyRepoBranchState))
}
