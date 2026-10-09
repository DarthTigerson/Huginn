import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  return { store }
})

vi.mock('../../lib/notifySettingChanged', () => ({ notifySettingChanged: vi.fn() }))

import { useGeneralSettingsStore } from '../generalSettingsStore'
import { notifySettingChanged } from '../../lib/notifySettingChanged'

describe('generalSettingsStore — file tree git status', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    vi.mocked(notifySettingChanged).mockClear()
  })

  it('shows letter and colour by default', () => {
    expect(useGeneralSettingsStore.getState().fileTreeGitStatus).toBe('letterAndColour')
  })

  it('saves the choice under the general sync prefix and pushes it to vIDE Sync', () => {
    useGeneralSettingsStore.getState().setFileTreeGitStatus('letter')
    expect(useGeneralSettingsStore.getState().fileTreeGitStatus).toBe('letter')
    expect(store['vide:general:fileTreeGitStatus']).toBe('letter')
    expect(notifySettingChanged).toHaveBeenCalledTimes(1)
  })

  it('keeps a saved choice', async () => {
    store['vide:general:fileTreeGitStatus'] = 'off'
    vi.resetModules()
    const { useGeneralSettingsStore: fresh } = await import('../generalSettingsStore')
    expect(fresh.getState().fileTreeGitStatus).toBe('off')
  })

  it('falls back to the default for an unknown saved value', async () => {
    store['vide:general:fileTreeGitStatus'] = 'rainbow'
    vi.resetModules()
    const { useGeneralSettingsStore: fresh } = await import('../generalSettingsStore')
    expect(fresh.getState().fileTreeGitStatus).toBe('letterAndColour')
  })
})

describe('generalSettingsStore — open new tabs in', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    vi.mocked(notifySettingChanged).mockClear()
  })

  it('defaults to the biggest window', async () => {
    vi.resetModules()
    const { useGeneralSettingsStore: fresh } = await import('../generalSettingsStore')
    expect(fresh.getState().newTabPane).toBe('biggest')
  })

  it('starts on the active window for someone who had switched off the old biggest-pane option', async () => {
    store['vide:general:openInBiggestPane'] = 'false'
    vi.resetModules()
    const { useGeneralSettingsStore: fresh } = await import('../generalSettingsStore')
    expect(fresh.getState().newTabPane).toBe('active')
  })

  it('saves the choice under the general sync prefix and pushes it to vIDE Sync', () => {
    useGeneralSettingsStore.getState().setNewTabPane('active')
    expect(useGeneralSettingsStore.getState().newTabPane).toBe('active')
    expect(store['vide:general:newTabPane']).toBe('active')
    expect(notifySettingChanged).toHaveBeenCalledTimes(1)
  })
})
