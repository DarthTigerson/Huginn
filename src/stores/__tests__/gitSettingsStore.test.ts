import { describe, it, expect, beforeEach, vi } from 'vitest'

// localStorage stub must be created before importing the store
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
})

import { useGitSettingsStore } from '../gitSettingsStore'

describe('gitSettingsStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    useGitSettingsStore.setState({
      forceSafetyEnabled: true,
      countdownEnabled: false,
      countdownSeconds: 5,
      autoContinueOnCountdownEnd: false,
    })
  })

  it('has correct defaults', () => {
    const s = useGitSettingsStore.getState()
    expect(s.forceSafetyEnabled).toBe(true)
    expect(s.countdownEnabled).toBe(false)
    expect(s.countdownSeconds).toBe(5)
    expect(s.autoContinueOnCountdownEnd).toBe(false)
  })

  it('setForceSafetyEnabled persists to localStorage', () => {
    useGitSettingsStore.getState().setForceSafetyEnabled(false)
    expect(useGitSettingsStore.getState().forceSafetyEnabled).toBe(false)
    expect(store['huginn:git:forceSafetyEnabled']).toBe('false')
  })

  it('setCountdownEnabled persists to localStorage', () => {
    useGitSettingsStore.getState().setCountdownEnabled(true)
    expect(useGitSettingsStore.getState().countdownEnabled).toBe(true)
    expect(store['huginn:git:countdownEnabled']).toBe('true')
  })

  it('setCountdownSeconds persists to localStorage', () => {
    useGitSettingsStore.getState().setCountdownSeconds(10)
    expect(useGitSettingsStore.getState().countdownSeconds).toBe(10)
    expect(store['huginn:git:countdownSeconds']).toBe('10')
  })

  it('setAutoContinueOnCountdownEnd persists to localStorage', () => {
    useGitSettingsStore.getState().setAutoContinueOnCountdownEnd(true)
    expect(useGitSettingsStore.getState().autoContinueOnCountdownEnd).toBe(true)
    expect(store['huginn:git:autoContinueOnCountdownEnd']).toBe('true')
  })
})
