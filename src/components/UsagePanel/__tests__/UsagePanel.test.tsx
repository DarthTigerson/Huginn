import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { UsagePanel } from '@/components/UsagePanel/UsagePanel'
import type { LatestUsage } from '@/types/api'

const SAMPLE: LatestUsage = {
  ts: Date.now(),
  sessionPct: 38,
  weeklyPct: 56,
  requests24h: 1877,
  requests7d: 4336,
  topSkills: [],
  sessionResetAt: Date.now() + 3_600_000,
  weeklyResetAt: Date.now() + 86_400_000,
  sessionAvgRatePerHour: 30.55,
  weeklyAvgRatePerHour: 0.73,
}

function mockApi(overrides: Partial<typeof window.api> = {}) {
  Object.defineProperty(window, 'api', {
    value: {
      usageAcquire: vi.fn().mockResolvedValue(undefined),
      usageRelease: vi.fn().mockResolvedValue(undefined),
      usageGetLatest: vi.fn().mockResolvedValue(null),
      onUsageUpdate: vi.fn().mockReturnValue(() => {}),
      ...overrides,
    },
    writable: true,
    configurable: true,
  })
}

describe('UsagePanel', () => {
  beforeEach(() => {
    mockApi()
  })

  it('acquires the usage source on mount', () => {
    render(<UsagePanel />)
    expect(window.api.usageAcquire).toHaveBeenCalledTimes(1)
  })

  it('releases the usage source on unmount', () => {
    const { unmount } = render(<UsagePanel />)
    unmount()
    expect(window.api.usageRelease).toHaveBeenCalledTimes(1)
  })

  it('shows a placeholder before any data has arrived', () => {
    render(<UsagePanel />)
    expect(screen.getByText('No usage data yet')).toBeTruthy()
  })

  it('renders gauges and burn-rate stats once data resolves', async () => {
    mockApi({ usageGetLatest: vi.fn().mockResolvedValue(SAMPLE) })
    render(<UsagePanel />)

    await waitFor(() => expect(screen.getByText('38%')).toBeTruthy())
    expect(screen.getByText('56%')).toBeTruthy()
    expect(screen.getByText('SESSION')).toBeTruthy()
    expect(screen.getByText('THIS WEEK')).toBeTruthy()
    expect(screen.getByText('≈30.55%/hr')).toBeTruthy()
    expect(screen.getByText('≈0.73%/hr')).toBeTruthy()
  })

  it('re-renders when a push update arrives', async () => {
    let pushUpdate: (data: LatestUsage | null) => void = () => {}
    mockApi({
      onUsageUpdate: vi.fn().mockImplementation((cb: (data: LatestUsage | null) => void) => {
        pushUpdate = cb
        return () => {}
      }),
    })
    render(<UsagePanel />)
    expect(screen.getByText('No usage data yet')).toBeTruthy()

    act(() => pushUpdate(SAMPLE))

    await waitFor(() => expect(screen.getByText('38%')).toBeTruthy())
  })
})
