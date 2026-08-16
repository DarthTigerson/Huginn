import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, configure } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useGitStore, useRepoGitState } from '@/stores/gitStore'
import { useGitSettingsStore } from '@/stores/gitSettingsStore'

vi.mock('@/stores/gitStore', () => ({
  useGitStore: vi.fn(),
  useRepoGitState: vi.fn(),
}))
vi.mock('@/stores/gitSettingsStore', () => ({
  useGitSettingsStore: vi.fn(),
}))

function mockGitStore(overrides = {}) {
  const state = { branch: 'main', forcePush: vi.fn(), forcePushLease: vi.fn(), ...overrides }
  vi.mocked(useGitStore).mockImplementation((sel: any) => sel(state))
  vi.mocked(useRepoGitState).mockReturnValue({ branch: state.branch } as any)
}

function mockSettings(overrides = {}) {
  vi.mocked(useGitSettingsStore).mockImplementation((sel: any) =>
    sel({
      forceSafetyEnabled: true,
      countdownEnabled: false,
      countdownSeconds: 5,
      autoContinueOnCountdownEnd: false,
      ...overrides,
    })
  )
}

import { ConfirmForcePushModal } from '@/components/Git/ConfirmForcePushModal'

describe('ConfirmForcePushModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // @testing-library/react's asyncWrapper drains microtasks via setTimeout(fn, 0).
    // With vitest fake timers active, that setTimeout is fake and never auto-fires.
    // We configure asyncWrapper to advance vitest's clock by 0ms after each cb so
    // the drain-microtask setTimeout fires immediately — no global monkey-patching needed.
    configure({
      asyncWrapper: async (cb) => {
        const result = await cb()
        await vi.advanceTimersByTimeAsync(0)
        return result
      },
    })
    mockGitStore()
    mockSettings()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows the branch name', () => {
    const onClose = vi.fn()
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={onClose} />)
    expect(screen.getByText(/origin\/main/)).toBeTruthy()
  })

  it('cancel button calls onClose without running command', async () => {
    const forcePush = vi.fn()
    mockGitStore({ forcePush })
    const onClose = vi.fn()
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={onClose} />)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync.bind(vi) })
    await user.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(forcePush).not.toHaveBeenCalled()
  })

  it('confirm button calls forcePush and then onClose (no countdown)', async () => {
    const forcePush = vi.fn().mockResolvedValue(undefined)
    mockGitStore({ forcePush })
    const onClose = vi.fn()
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={onClose} />)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync.bind(vi) })
    await user.click(screen.getByText('Confirm'))
    expect(forcePush).toHaveBeenCalledWith('/proj')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows countdown ticking down and no Confirm button initially', () => {
    mockSettings({ countdownEnabled: true, countdownSeconds: 3, autoContinueOnCountdownEnd: false })
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={vi.fn()} />)
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.queryByText('Confirm')).toBeNull()
  })

  it('shows Confirm after countdown with autoContinue=false', async () => {
    mockSettings({ countdownEnabled: true, countdownSeconds: 2, autoContinueOnCountdownEnd: false })
    const forcePush = vi.fn().mockResolvedValue(undefined)
    mockGitStore({ forcePush })
    const onClose = vi.fn()
    render(<ConfirmForcePushModal action="forcePush" cwd="/proj" onClose={onClose} />)
    expect(screen.queryByText('Confirm')).toBeNull()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByText('Confirm')).toBeTruthy()
    expect(forcePush).not.toHaveBeenCalled()
  })

  it('auto-fires and closes when autoContinue=true after countdown', async () => {
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
