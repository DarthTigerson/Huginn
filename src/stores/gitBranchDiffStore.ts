import { create } from 'zustand'
import type { GitCommit } from '@/types/index'

// Mirrors GIT_LOG_PAGE_SIZE in electron/git.ts — a page shorter than this is
// the last one, so a page exactly this long is the signal to keep paging.
export const GIT_LOG_PAGE_SIZE = 100

// Backs GitBranchDiffPage (List Diff). Previously all of this lived in local
// useState, which meant opening a file from a commit's changed-files list —
// backgrounding the List Diff tab — silently reset the source/target branch
// selection and the selected commit the moment the user switched back,
// since the component fully unmounts/remounts (Editor.tsx only renders the
// active tab's content per pane). gitGraphStore already avoided this for
// the Graph page; this mirrors that.
interface GitBranchDiffStore {
  branches: string[]
  defaultBranch: string | null
  source: string
  target: string
  commits: GitCommit[]
  loadingBranches: boolean
  loadingCommits: boolean
  loadingMore: boolean
  hasMore: boolean
  selectedHash: string | null
  setBranches: (branches: string[]) => void
  setDefaultBranch: (branch: string | null) => void
  setSourceIfEmpty: (source: string) => void
  setSource: (source: string) => void
  setTargetIfEmpty: (target: string) => void
  setTarget: (target: string) => void
  setLoadingBranches: (loading: boolean) => void
  setCommits: (commits: GitCommit[]) => void
  appendCommits: (commits: GitCommit[]) => void
  setLoadingCommits: (loading: boolean) => void
  setLoadingMore: (loading: boolean) => void
  select: (hash: string | null) => void
}

export const useGitBranchDiffStore = create<GitBranchDiffStore>((set) => ({
  branches: [],
  defaultBranch: null,
  source: '',
  target: '',
  commits: [],
  loadingBranches: false,
  loadingCommits: false,
  loadingMore: false,
  hasMore: true,
  selectedHash: null,

  setBranches: (branches) => set({ branches }),
  setDefaultBranch: (defaultBranch) => set({ defaultBranch }),
  setSourceIfEmpty: (source) => set((s) => ({ source: s.source || source })),
  setSource: (source) => set({ source }),
  setTargetIfEmpty: (target) => set((s) => ({ target: s.target || target })),
  setTarget: (target) => set({ target }),
  setLoadingBranches: (loadingBranches) => set({ loadingBranches }),
  // Clears the selection only if the previously-selected commit isn't in
  // the freshly-loaded list — keeps it across a remount with the same
  // source/target (opening a file, then switching back to this tab), but
  // still drops it once it's genuinely stale (source/target changed to
  // something that no longer includes that commit).
  setCommits: (commits) =>
    set((s) => ({
      commits,
      hasMore: commits.length >= GIT_LOG_PAGE_SIZE,
      loadingMore: false,
      selectedHash: s.selectedHash && commits.some((c) => c.hash === s.selectedHash) ? s.selectedHash : null,
    })),
  appendCommits: (commits) =>
    set((s) => ({
      commits: [...s.commits, ...commits],
      hasMore: commits.length >= GIT_LOG_PAGE_SIZE,
      loadingMore: false,
    })),
  setLoadingCommits: (loadingCommits) => set({ loadingCommits }),
  setLoadingMore: (loadingMore) => set({ loadingMore }),
  select: (hash) => set({ selectedHash: hash }),
}))
