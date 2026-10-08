import { describe, it, expect, beforeEach, vi } from 'vitest'

const { localStorageStore, openTab, openTabInPane, settings } = vi.hoisted(() => {
  const localStorageStore: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => localStorageStore[k] ?? null,
    setItem: (k: string, v: string) => { localStorageStore[k] = v },
    removeItem: (k: string) => { delete localStorageStore[k] },
  }
  return { localStorageStore, openTab: vi.fn(), openTabInPane: vi.fn(), settings: { openInBiggestPane: false } }
})

vi.mock('@/stores/editorStore', () => ({ useEditorStore: { getState: () => ({ openTab, openTabInPane }) } }))
vi.mock('@/stores/generalSettingsStore', () => ({ useGeneralSettingsStore: { getState: () => settings } }))
vi.mock('@/lib/paneLayout', () => ({ getBiggestPaneId: () => 'pane-big' }))

import { useChangelogStore, PENDING_CHANGELOG_KEY, UPDATED_FROM_KEY } from '../changelogStore'

const ABOUT = 'settings://About'

describe('changelogStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k])
    settings.openInBiggestPane = false
    useChangelogStore.setState({ justUpdated: null })
  })

  it('does nothing on a normal startup', () => {
    useChangelogStore.getState().checkPending()
    expect(openTab).not.toHaveBeenCalled()
    expect(useChangelogStore.getState().justUpdated).toBeNull()
  })

  it('after an update, opens Settings > About and remembers which version it came from', () => {
    localStorage.setItem(PENDING_CHANGELOG_KEY, '0.2.20')
    localStorage.setItem(UPDATED_FROM_KEY, '0.2.19')
    useChangelogStore.getState().checkPending()
    expect(openTab).toHaveBeenCalledWith(expect.objectContaining({ path: ABOUT }))
    expect(useChangelogStore.getState().justUpdated).toEqual({ to: '0.2.20', from: '0.2.19' })
  })

  it('clears both keys so it only happens once', () => {
    localStorage.setItem(PENDING_CHANGELOG_KEY, '0.2.20')
    localStorage.setItem(UPDATED_FROM_KEY, '0.2.19')
    useChangelogStore.getState().checkPending()
    expect(localStorage.getItem(PENDING_CHANGELOG_KEY)).toBeNull()
    expect(localStorage.getItem(UPDATED_FROM_KEY)).toBeNull()
  })

  it('still opens About when the previous build did not record where it came from', () => {
    localStorage.setItem(PENDING_CHANGELOG_KEY, '0.2.20')
    useChangelogStore.getState().checkPending()
    expect(useChangelogStore.getState().justUpdated).toEqual({ to: '0.2.20', from: null })
    expect(openTab).toHaveBeenCalled()
  })

  it('respects "Always open in biggest pane"', () => {
    settings.openInBiggestPane = true
    localStorage.setItem(PENDING_CHANGELOG_KEY, '0.2.20')
    useChangelogStore.getState().checkPending()
    expect(openTabInPane).toHaveBeenCalledWith(expect.objectContaining({ path: ABOUT }), 'pane-big')
    expect(openTab).not.toHaveBeenCalled()
  })
})
