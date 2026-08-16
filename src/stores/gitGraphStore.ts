import { create } from 'zustand'
import type { GitCommit } from '@/types/index'

export interface RepoGraphState {
  commits: GitCommit[]
  selectedHash: string | null
  loading: boolean
}

export const emptyRepoGraphState: RepoGraphState = {
  commits: [],
  selectedHash: null,
  loading: false,
}

interface GitGraphStore {
  repos: Record<string, RepoGraphState>
  load: (cwd: string) => Promise<void>
  select: (cwd: string, hash: string | null) => void
}

export const useGitGraphStore = create<GitGraphStore>((set, get) => ({
  repos: {},

  load: async (cwd) => {
    set((s) => ({ repos: { ...s.repos, [cwd]: { ...(s.repos[cwd] ?? emptyRepoGraphState), loading: true } } }))
    const commits = await window.api.gitGraph(cwd)
    set((s) => ({
      repos: {
        ...s.repos,
        [cwd]: { commits, selectedHash: get().repos[cwd]?.selectedHash ?? null, loading: false },
      },
    }))
  },

  select: (cwd, hash) =>
    set((s) => ({ repos: { ...s.repos, [cwd]: { ...(s.repos[cwd] ?? emptyRepoGraphState), selectedHash: hash } } })),
}))

export function useRepoGraphState(cwd: string | null): RepoGraphState {
  return useGitGraphStore((s) => (cwd ? s.repos[cwd] ?? emptyRepoGraphState : emptyRepoGraphState))
}
