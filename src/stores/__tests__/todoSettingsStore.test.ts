import { describe, it, expect, beforeEach, vi } from 'vitest'

const { localStorageStore } = vi.hoisted(() => {
  const localStorageStore: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => localStorageStore[k] ?? null,
    setItem: (k: string, v: string) => { localStorageStore[k] = v },
    removeItem: (k: string) => { delete localStorageStore[k] },
  }
  return { localStorageStore }
})

import { useTodoSettingsStore } from '../todoSettingsStore'

describe('todoSettingsStore', () => {
  beforeEach(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k])
    useTodoSettingsStore.setState({ externalUrl: '', closeSidePanelOnOpen: false })
  })

  it('defaults to an empty URL', () => {
    expect(useTodoSettingsStore.getState().externalUrl).toBe('')
  })

  it('setExternalUrl updates state and persists to localStorage', () => {
    useTodoSettingsStore.getState().setExternalUrl('https://team.atlassian.net/jira/board')
    expect(useTodoSettingsStore.getState().externalUrl).toBe('https://team.atlassian.net/jira/board')
    expect(localStorageStore['huginn:todo:externalUrl']).toBe('https://team.atlassian.net/jira/board')
  })

  it('defaults closeSidePanelOnOpen to false', () => {
    expect(useTodoSettingsStore.getState().closeSidePanelOnOpen).toBe(false)
  })

  it('setCloseSidePanelOnOpen updates state and persists to localStorage', () => {
    useTodoSettingsStore.getState().setCloseSidePanelOnOpen(true)
    expect(useTodoSettingsStore.getState().closeSidePanelOnOpen).toBe(true)
    expect(localStorageStore['huginn:todo:closeSidePanel']).toBe('true')
  })
})
