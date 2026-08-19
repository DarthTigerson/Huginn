import { create } from 'zustand'
import type { GitCommit } from '@/types/index'
import { EMPTY_COMMIT_FILTERS, hasActiveFilters, type CommitFilters } from '@/components/Git/commitFilter'

// Mirrors GIT_LOG_PAGE_SIZE in electron/git.ts — a page shorter than this is
// the last one, so a page exactly this long is the signal to keep paging.
const PAGE_SIZE = 100

// The one-off, much larger fetch triggered the moment search/filters first
// become active, so filtering can search deep history instead of just
// whatever's been paginated in so far.
const SEARCH_FETCH_LIMIT = 2000

export interface RepoGraphState {
  commits: GitCommit[]
  selectedHash: string | null
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  filters: CommitFilters
  wideFetched: boolean
}

export const emptyRepoGraphState: RepoGraphState = {
  commits: [],
  selectedHash: null,
  loading: false,
  loadingMore: false,
  hasMore: true,
  filters: EMPTY_COMMIT_FILTERS,
  wideFetched: false,
}

interface GitGraphStore {
  repos: Record<string, RepoGraphState>
  load: (cwd: string) => Promise<void>
  loadMore: (cwd: string) => Promise<void>
  loadWide: (cwd: string) => Promise<void>
  select: (cwd: string, hash: string | null) => void
  setFilters: (cwd: string, patch: Partial<CommitFilters>) => void
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
          ...emptyRepoGraphState,
          commits,
          selectedHash: get().repos[cwd]?.selectedHash ?? null,
          loading: false,
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

  // Fired once, the moment search/filters go from inactive to active (see
  // setFilters) — replaces the paginated small page with a much deeper fetch
  // so filtering has real history to search, not just what's scrolled in.
  loadWide: async (cwd) => {
    set((s) => ({ repos: { ...s.repos, [cwd]: { ...(s.repos[cwd] ?? emptyRepoGraphState), loading: true } } }))
    const commits = await window.api.gitGraph(cwd, 0, SEARCH_FETCH_LIMIT)
    set((s) => ({
      repos: {
        ...s.repos,
        [cwd]: {
          ...(s.repos[cwd] ?? emptyRepoGraphState),
          commits,
          loading: false,
          loadingMore: false,
          hasMore: commits.length >= SEARCH_FETCH_LIMIT,
          wideFetched: true,
        },
      },
    }))
  },

  select: (cwd, hash) =>
    set((s) => ({ repos: { ...s.repos, [cwd]: { ...(s.repos[cwd] ?? emptyRepoGraphState), selectedHash: hash } } })),

  setFilters: (cwd, patch) => {
    const current = get().repos[cwd] ?? emptyRepoGraphState
    const nextFilters = { ...current.filters, ...patch }
    set((s) => ({ repos: { ...s.repos, [cwd]: { ...current, filters: nextFilters } } }))

    if (!current.wideFetched && !hasActiveFilters(current.filters) && hasActiveFilters(nextFilters)) {
      get().loadWide(cwd)
    }
  },
}))

export function useRepoGraphState(cwd: string | null): RepoGraphState {
  return useGitGraphStore((s) => (cwd ? s.repos[cwd] ?? emptyRepoGraphState : emptyRepoGraphState))
}
