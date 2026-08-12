import { create } from 'zustand'
import type { GitCommit } from '@/types/index'

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
  selectedHash: string | null
  setBranches: (branches: string[]) => void
  setDefaultBranch: (branch: string | null) => void
  setSourceIfEmpty: (source: string) => void
  setSource: (source: string) => void
  setTargetIfEmpty: (target: string) => void
  setTarget: (target: string) => void
  setLoadingBranches: (loading: boolean) => void
  setCommits: (commits: GitCommit[]) => void
  setLoadingCommits: (loading: boolean) => void
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
      selectedHash: s.selectedHash && commits.some((c) => c.hash === s.selectedHash) ? s.selectedHash : null,
    })),
  setLoadingCommits: (loadingCommits) => set({ loadingCommits }),
  select: (hash) => set({ selectedHash: hash }),
}))
