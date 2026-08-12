import { create } from 'zustand'

const KEYS = {
  forceSafetyEnabled:        'huginn:git:forceSafetyEnabled',
  countdownEnabled:          'huginn:git:countdownEnabled',
  countdownSeconds:          'huginn:git:countdownSeconds',
  autoContinueOnCountdownEnd:'huginn:git:autoContinueOnCountdownEnd',
  listDiffTargetBranches:    'huginn:git:listDiffTargetBranches',
  periodicFetchEnabled:      'huginn:git:periodicFetchEnabled',
  periodicFetchIntervalMinutes: 'huginn:git:periodicFetchIntervalMinutes',
}

function getBool(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key)
  return v === null ? def : v === 'true'
}

function getInt(key: string, def: number): number {
  const v = localStorage.getItem(key)
  return v === null ? def : parseInt(v, 10)
}

function getBranchMap(key: string): Record<string, string> {
  const v = localStorage.getItem(key)
  if (!v) return {}
  try {
    const parsed = JSON.parse(v)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

interface GitSettingsStore {
  forceSafetyEnabled: boolean
  countdownEnabled: boolean
  countdownSeconds: number
  autoContinueOnCountdownEnd: boolean
  listDiffTargetBranches: Record<string, string>
  periodicFetchEnabled: boolean
  periodicFetchIntervalMinutes: number
  setForceSafetyEnabled: (v: boolean) => void
  setCountdownEnabled: (v: boolean) => void
  setCountdownSeconds: (v: number) => void
  setAutoContinueOnCountdownEnd: (v: boolean) => void
  getListDiffTargetBranch: (repoPath: string) => string
  setListDiffTargetBranch: (repoPath: string, branch: string) => void
  setPeriodicFetchEnabled: (v: boolean) => void
  setPeriodicFetchIntervalMinutes: (v: number) => void
}

export const useGitSettingsStore = create<GitSettingsStore>((set, get) => ({
  forceSafetyEnabled:         getBool(KEYS.forceSafetyEnabled, true),
  countdownEnabled:           getBool(KEYS.countdownEnabled, false),
  countdownSeconds:           getInt(KEYS.countdownSeconds, 5),
  autoContinueOnCountdownEnd: getBool(KEYS.autoContinueOnCountdownEnd, false),
  listDiffTargetBranches:     getBranchMap(KEYS.listDiffTargetBranches),
  periodicFetchEnabled:       getBool(KEYS.periodicFetchEnabled, true),
  periodicFetchIntervalMinutes: getInt(KEYS.periodicFetchIntervalMinutes, 5),

  setForceSafetyEnabled: (v) => {
    localStorage.setItem(KEYS.forceSafetyEnabled, String(v))
    set({ forceSafetyEnabled: v })
  },
  setCountdownEnabled: (v) => {
    localStorage.setItem(KEYS.countdownEnabled, String(v))
    set({ countdownEnabled: v })
  },
  setCountdownSeconds: (v) => {
    localStorage.setItem(KEYS.countdownSeconds, String(v))
    set({ countdownSeconds: v })
  },
  setAutoContinueOnCountdownEnd: (v) => {
    localStorage.setItem(KEYS.autoContinueOnCountdownEnd, String(v))
    set({ autoContinueOnCountdownEnd: v })
  },
  getListDiffTargetBranch: (repoPath) => get().listDiffTargetBranches[repoPath] ?? '',
  setListDiffTargetBranch: (repoPath, branch) => {
    const next = { ...get().listDiffTargetBranches }
    if (branch) {
      next[repoPath] = branch
    } else {
      delete next[repoPath]
    }
    localStorage.setItem(KEYS.listDiffTargetBranches, JSON.stringify(next))
    set({ listDiffTargetBranches: next })
  },
  setPeriodicFetchEnabled: (v) => {
    localStorage.setItem(KEYS.periodicFetchEnabled, String(v))
    set({ periodicFetchEnabled: v })
  },
  setPeriodicFetchIntervalMinutes: (v) => {
    const clamped = Math.max(1, Math.min(120, v))
    localStorage.setItem(KEYS.periodicFetchIntervalMinutes, String(clamped))
    set({ periodicFetchIntervalMinutes: clamped })
  },
}))
