import { describe, it, expect, vi } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import { UsageChart } from '../UsageChart'
import type { LatestUsage, UsageSnapshot } from '@/types/api'

const NOW = Date.now()

function usage(overrides: Partial<LatestUsage> = {}): LatestUsage {
  return {
    ts: NOW,
    sessionPct: 50,
    weeklyPct: 20,
    requests24h: 0,
    requests7d: 0,
    topSkills: [],
    sessionResetAt: null,
    weeklyResetAt: null,
    sessionAvgRatePerHour: null,
    weeklyAvgRatePerHour: null,
    sessionCutoffAt: null,
    weeklyCutoffAt: null,
    ...overrides,
  }
}

function snap(ts: number, pct: number): UsageSnapshot {
  return { ts, sessionPct: pct, weeklyPct: pct, requests24h: 0, requests7d: 0, topSkills: [], sessionResetAt: null, weeklyResetAt: null }
}

function mockApi(snapshots: UsageSnapshot[]) {
  Object.defineProperty(window, 'api', {
    value: { usageGetRange: vi.fn().mockResolvedValue(snapshots) },
    writable: true,
    configurable: true,
  })
}

describe('UsageChart (session metric)', () => {
  it('shows a placeholder before there is enough history', async () => {
    mockApi([])
    const { getByText, container } = render(<UsageChart latest={usage()} metric="session" />)
    await waitFor(() => expect(window.api.usageGetRange).toHaveBeenCalled())
    expect(getByText(/not enough history/i)).toBeTruthy()
    expect(container.querySelector('polyline')).toBeNull()
  })

  it('draws the session line and percent gridlines once history resolves', async () => {
    mockApi([snap(NOW - 3_600_000, 10), snap(NOW, 50)])
    const { container, getByText } = render(<UsageChart latest={usage()} metric="session" />)

    await waitFor(() => expect(container.querySelector('polyline')).toBeTruthy())
    expect(getByText('100%')).toBeTruthy()
    expect(getByText('0%')).toBeTruthy()
  })

  it('draws a dashed projection line to the session cutoff when it falls inside the visible window', async () => {
    mockApi([snap(NOW - 3_600_000, 10), snap(NOW, 50)])
    const cutoffAt = NOW + 60 * 60_000
    const { container } = render(<UsageChart latest={usage({ sessionCutoffAt: cutoffAt })} metric="session" />)

    await waitFor(() => expect(container.querySelector('polyline')).toBeTruthy())
    expect(container.querySelector('[data-testid="projection-line"]')).toBeTruthy()
  })

  it('defaults to the 24h range and requests history for a 24h window', async () => {
    mockApi([snap(NOW - 3_600_000, 10), snap(NOW, 50)])
    render(<UsageChart latest={usage()} metric="session" />)

    await waitFor(() => expect(window.api.usageGetRange).toHaveBeenCalled())
    const [from, to] = (window.api.usageGetRange as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(to - from).toBe(86_400_000)
  })

  it('re-requests history for the newly selected range when a range button is clicked', async () => {
    mockApi([snap(NOW - 3_600_000, 10), snap(NOW, 50)])
    const { getByRole } = render(<UsageChart latest={usage()} metric="session" />)
    await waitFor(() => expect(window.api.usageGetRange).toHaveBeenCalledTimes(1))

    fireEvent.click(getByRole('button', { name: '7D' }))

    await waitFor(() => expect(window.api.usageGetRange).toHaveBeenCalledTimes(2))
    const [from, to] = (window.api.usageGetRange as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(to - from).toBe(604_800_000)
  })

  it('shows a tooltip with the nearest snapshot on hover', async () => {
    mockApi([snap(NOW - 3_600_000, 10), snap(NOW, 50)])
    const { container } = render(<UsageChart latest={usage()} metric="session" />)
    await waitFor(() => expect(container.querySelector('polyline')).toBeTruthy())

    const plot = container.querySelector('[data-testid="chart-plot"]') as HTMLElement
    vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 200, width: 200, top: 0, bottom: 100, height: 100, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.pointerDown(plot, { clientX: 198 })

    await waitFor(() => expect(container.querySelector('[data-testid="chart-tooltip"]')).toBeTruthy())
    expect(container.querySelector('[data-testid="chart-tooltip"]')?.textContent).toMatch(/50% session/)
  })
})

describe('UsageChart (weekly metric)', () => {
  it('shows the "Weekly usage" title and defaults to the 7d range', async () => {
    mockApi([snap(NOW - 86_400_000, 10), snap(NOW, 50)])
    const { getByText, getByRole } = render(<UsageChart latest={usage()} metric="weekly" />)

    expect(getByText('Weekly usage')).toBeTruthy()
    await waitFor(() => expect(window.api.usageGetRange).toHaveBeenCalled())
    const [from, to] = (window.api.usageGetRange as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(to - from).toBe(604_800_000)
    expect(getByRole('button', { name: '7D' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('draws a dashed projection line to the weekly cutoff, independent of the session cutoff', async () => {
    mockApi([snap(NOW - 86_400_000, 10), snap(NOW, 50)])
    const cutoffAt = NOW + 24 * 60 * 60_000
    const { container } = render(
      <UsageChart latest={usage({ sessionCutoffAt: null, weeklyCutoffAt: cutoffAt })} metric="weekly" />
    )

    await waitFor(() => expect(container.querySelector('polyline')).toBeTruthy())
    expect(container.querySelector('[data-testid="projection-line"]')).toBeTruthy()
  })

  it('shows a tooltip labeled "week" using weeklyPct on hover', async () => {
    mockApi([snap(NOW - 86_400_000, 10), snap(NOW, 50)])
    const { container } = render(<UsageChart latest={usage()} metric="weekly" />)
    await waitFor(() => expect(container.querySelector('polyline')).toBeTruthy())

    const plot = container.querySelector('[data-testid="chart-plot"]') as HTMLElement
    vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 200, width: 200, top: 0, bottom: 100, height: 100, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.pointerDown(plot, { clientX: 198 })

    await waitFor(() => expect(container.querySelector('[data-testid="chart-tooltip"]')).toBeTruthy())
    expect(container.querySelector('[data-testid="chart-tooltip"]')?.textContent).toMatch(/50% week/)
  })
})
