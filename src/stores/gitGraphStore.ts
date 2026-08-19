import { create } from 'zustand'
import type { GitCommit } from '@/types/index'

// Mirrors GIT_LOG_PAGE_SIZE in electron/git.ts — a page shorter than this is
// the last one, so a page exactly this long is the signal to keep paging.
const PAGE_SIZE = 100

export interface RepoGraphState {
  commits: GitCommit[]
  selectedHash: string | null
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
}

export const emptyRepoGraphState: RepoGraphState = {
  commits: [],
  selectedHash: null,
  loading: false,
  loadingMore: false,
  hasMore: true,
}

interface GitGraphStore {
  repos: Record<string, RepoGraphState>
  load: (cwd: string) => Promise<void>
  loadMore: (cwd: string) => Promise<void>
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
        [cwd]: {
          commits,
          selectedHash: get().repos[cwd]?.selectedHash ?? null,
          loading: false,
          loadingMore: false,
          hasMore: commits.length >= PAGE_SIZE,
        },
      },
    }))
  },

  // Offset is just the count already loaded — the backend pages via
  // `--skip <offset>`, so however many commits we already have IS the
  // correct skip amount for the next page.
  loadMore: async (cwd) => {
    const state = get().repos[cwd] ?? emptyRepoGraphState
    if (state.loading || state.loadingMore || !state.hasMore) return
    set((s) => ({ repos: { ...s.repos, [cwd]: { ...state, loadingMore: true } } }))
    const nextPage = await window.api.gitGraph(cwd, state.commits.length)
    set((s) => {
      const current = s.repos[cwd] ?? emptyRepoGraphState
      return {
        repos: {
          ...s.repos,
          [cwd]: {
            ...current,
            commits: [...current.commits, ...nextPage],
            loadingMore: false,
            hasMore: nextPage.length >= PAGE_SIZE,
          },
        },
      }
    })
  },

  select: (cwd, hash) =>
    set((s) => ({ repos: { ...s.repos, [cwd]: { ...(s.repos[cwd] ?? emptyRepoGraphState), selectedHash: hash } } })),
}))

export function useRepoGraphState(cwd: string | null): RepoGraphState {
  return useGitGraphStore((s) => (cwd ? s.repos[cwd] ?? emptyRepoGraphState : emptyRepoGraphState))
}
