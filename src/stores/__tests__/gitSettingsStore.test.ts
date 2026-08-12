import { describe, it, expect, beforeEach, vi } from 'vitest'

// vi.hoisted runs before any module import (including the store below),
// which is necessary because gitSettingsStore reads localStorage at init time.
const { store } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  return { store }
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
      listDiffTargetBranches: {},
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

  it('getListDiffTargetBranch defaults to empty string for an unconfigured repo', () => {
    expect(useGitSettingsStore.getState().getListDiffTargetBranch('/repo/a')).toBe('')
  })

  it('setListDiffTargetBranch persists per-repo and to localStorage', () => {
    const { setListDiffTargetBranch, getListDiffTargetBranch } = useGitSettingsStore.getState()
    setListDiffTargetBranch('/repo/a', 'develop')
    setListDiffTargetBranch('/repo/b', 'main')

    expect(getListDiffTargetBranch('/repo/a')).toBe('develop')
    expect(getListDiffTargetBranch('/repo/b')).toBe('main')
    expect(JSON.parse(store['huginn:git:listDiffTargetBranches'])).toEqual({
      '/repo/a': 'develop',
      '/repo/b': 'main',
    })
  })

  it('setListDiffTargetBranch with an empty string clears the repo entry', () => {
    const { setListDiffTargetBranch, getListDiffTargetBranch } = useGitSettingsStore.getState()
    setListDiffTargetBranch('/repo/a', 'develop')
    setListDiffTargetBranch('/repo/a', '')

    expect(getListDiffTargetBranch('/repo/a')).toBe('')
    expect(JSON.parse(store['huginn:git:listDiffTargetBranches'])).toEqual({})
  })
})
