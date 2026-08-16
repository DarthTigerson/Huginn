import { create } from 'zustand'

interface GitLogStore {
  repos: Record<string, string>
  append: (cwd: string, chunk: string) => void
}

export const useGitLogStore = create<GitLogStore>((set) => ({
  repos: {},
  append: (cwd, chunk) =>
    set((s) => ({ repos: { ...s.repos, [cwd]: (s.repos[cwd] ?? '') + chunk } })),
}))

export function useRepoGitLogText(cwd: string | null): string {
  return useGitLogStore((s) => (cwd ? s.repos[cwd] ?? '' : ''))
}
