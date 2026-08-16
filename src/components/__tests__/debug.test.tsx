import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useGitStore, useRepoGitState } from '@/stores/gitStore'
import { useGitSettingsStore } from '@/stores/gitSettingsStore'

vi.mock('@/stores/gitStore', () => ({ useGitStore: vi.fn(), useRepoGitState: vi.fn() }))
vi.mock('@/stores/gitSettingsStore', () => ({ useGitSettingsStore: vi.fn() }))

function mockGitStore(overrides = {}) {
  const state = { branch: 'main', forcePush: vi.fn(), forcePushLease: vi.fn(), ...overrides }
  vi.mocked(useGitStore).mockImplementation((sel: any) => sel(state))
  vi.mocked(useRepoGitState).mockReturnValue({ branch: state.branch } as any)
}
function mockSettings(overrides = {}) {
  vi.mocked(useGitSettingsStore).mockImplementation((sel: any) =>
    sel({ forceSafetyEnabled: true, countdownEnabled: false, countdownSeconds: 5, autoContinueOnCountdownEnd: false, ...overrides })
  )
}

import { ConfirmForcePushModal } from '@/components/Git/ConfirmForcePushModal'

describe('debug', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGitStore()
    mockSettings()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-continue exactly as in brief (sync act)', async () => {
    mockSettings({ countdownEnabled: true, countdownSeconds: 2, autoContinueOnCountdownEnd: true })
    const forcePush = vi.fn().mockResolvedValue(undefined)
    mockGitStore({ forcePush })
    const onClose = vi.fn()
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={onClose} />)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(forcePush).toHaveBeenCalledWith('/proj')
    expect(onClose).toHaveBeenCalled()
  })
})
