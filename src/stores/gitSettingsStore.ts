import { create } from 'zustand'

const KEYS = {
  forceSafetyEnabled:        'huginn:git:forceSafetyEnabled',
  countdownEnabled:          'huginn:git:countdownEnabled',
  countdownSeconds:          'huginn:git:countdownSeconds',
  autoContinueOnCountdownEnd:'huginn:git:autoContinueOnCountdownEnd',
}

function getBool(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key)
  return v === null ? def : v === 'true'
}

function getInt(key: string, def: number): number {
  const v = localStorage.getItem(key)
  return v === null ? def : parseInt(v, 10)
}

interface GitSettingsStore {
  forceSafetyEnabled: boolean
  countdownEnabled: boolean
  countdownSeconds: number
  autoContinueOnCountdownEnd: boolean
  setForceSafetyEnabled: (v: boolean) => void
  setCountdownEnabled: (v: boolean) => void
  setCountdownSeconds: (v: number) => void
  setAutoContinueOnCountdownEnd: (v: boolean) => void
}

export const useGitSettingsStore = create<GitSettingsStore>((set) => ({
  forceSafetyEnabled:         getBool(KEYS.forceSafetyEnabled, true),
  countdownEnabled:           getBool(KEYS.countdownEnabled, false),
  countdownSeconds:           getInt(KEYS.countdownSeconds, 5),
  autoContinueOnCountdownEnd: getBool(KEYS.autoContinueOnCountdownEnd, false),

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
}))
