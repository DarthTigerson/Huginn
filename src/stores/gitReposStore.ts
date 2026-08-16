import { create } from 'zustand'
import { useGitStore } from './gitStore'
import { useStatusMessageStore } from './statusMessageStore'

interface GitReposStore {
  repos: string[]
  selectedRepo: string | null
  setRepos: (repos: string[]) => void
  selectRepo: (repo: string) => void
  resolveRepoForPath: (absPath: string) => string | null
  followFilePath: (absPath: string) => void
}

export const useGitReposStore = create<GitReposStore>((set, get) => ({
  repos: [],
  selectedRepo: null,

  // Called once per project open/reload with the freshly discovered repo
  // list. Keeps the current selection if it's still valid (e.g. a
  // discovery re-run after a repo was added), otherwise falls back to the
  // first (sorted) repo, or null if there are none.
  setRepos: (repos) => {
    const current = get().selectedRepo
    const selectedRepo = current && repos.includes(current) ? current : (repos[0] ?? null)
    set({ repos, selectedRepo })
  },

  selectRepo: (repo) => set({ selectedRepo: repo }),

  resolveRepoForPath: (absPath) => {
    let match: string | null = null
    for (const repo of get().repos) {
      if (absPath !== repo && !absPath.startsWith(`${repo}/`)) continue
      if (!match || repo.length > match.length) match = repo
    }
    return match
  },

  // The ONLY call site that should fire the "Switched to…" footer notice —
  // manual picks (Git Panel dropdown, "Show All Repos" row) call
  // selectRepo() directly and stay silent, since the click itself is
  // already the user's confirmation.
  followFilePath: (absPath) => {
    const repo = get().resolveRepoForPath(absPath)
    if (!repo || repo === get().selectedRepo) return
    set({ selectedRepo: repo })
    const name = repo.split('/').pop()
    const branch = useGitStore.getState().repos[repo]?.branch
    useStatusMessageStore.getState().show(branch ? `Switched to ${name} on ${branch}` : `Switched to ${name}`)
  },
}))
