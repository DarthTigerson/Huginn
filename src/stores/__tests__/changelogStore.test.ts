import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChangelogStore, PENDING_CHANGELOG_KEY } from '../changelogStore'

const { localStorageStore } = vi.hoisted(() => {
  const localStorageStore: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => localStorageStore[k] ?? null,
    setItem: (k: string, v: string) => { localStorageStore[k] = v },
    removeItem: (k: string) => { delete localStorageStore[k] },
  }
  return { localStorageStore }
})

vi.stubGlobal('window', {
  api: {
    getChangelogForVersion: vi.fn().mockResolvedValue('## v0.2.0\n- New stuff'),
  },
})

describe('changelogStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k])
    useChangelogStore.setState({ version: null, content: null })
  })

  it('starts with nothing to show', () => {
    const { version, content } = useChangelogStore.getState()
    expect(version).toBeNull()
    expect(content).toBeNull()
  })

  it('checkPending does nothing when no version is pending', async () => {
    await useChangelogStore.getState().checkPending()
    expect(window.api.getChangelogForVersion).not.toHaveBeenCalled()
    expect(useChangelogStore.getState().content).toBeNull()
  })

  it('checkPending fetches and shows the pending version, then clears the flag', async () => {
    localStorage.setItem(PENDING_CHANGELOG_KEY, '0.2.0')
    await useChangelogStore.getState().checkPending()
    expect(window.api.getChangelogForVersion).toHaveBeenCalledWith('0.2.0')
    expect(useChangelogStore.getState().version).toBe('0.2.0')
    expect(useChangelogStore.getState().content).toBe('## v0.2.0\n- New stuff')
    expect(localStorage.getItem(PENDING_CHANGELOG_KEY)).toBeNull()
  })

  it('clears the pending flag even if the fetch comes back empty', async () => {
    vi.mocked(window.api.getChangelogForVersion).mockResolvedValueOnce(null)
    localStorage.setItem(PENDING_CHANGELOG_KEY, '9.9.9')
    await useChangelogStore.getState().checkPending()
    expect(localStorage.getItem(PENDING_CHANGELOG_KEY)).toBeNull()
    expect(useChangelogStore.getState().content).toBeNull()
  })

  it('dismiss clears version and content', () => {
    useChangelogStore.setState({ version: '0.2.0', content: '## v0.2.0' })
    useChangelogStore.getState().dismiss()
    expect(useChangelogStore.getState().version).toBeNull()
    expect(useChangelogStore.getState().content).toBeNull()
  })
})
