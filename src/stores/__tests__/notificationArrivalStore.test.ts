import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useNotificationArrivalStore } from '../notificationArrivalStore'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_000)
  useNotificationArrivalStore.setState({ knownIds: [], arrival: null })
})

afterEach(() => {
  vi.useRealTimers()
})

const observe = (ids: string[]) => useNotificationArrivalStore.getState().observe(ids)
const arrival = () => useNotificationArrivalStore.getState().arrival

describe('notificationArrivalStore', () => {
  it('records a newly active id as an arrival', () => {
    observe(['docker'])
    expect(arrival()).toEqual({ id: 'docker', at: 1_000 })
  })

  it('does not re-announce an id that stays active', () => {
    observe(['docker'])
    vi.setSystemTime(5_000)
    observe(['docker'])
    expect(arrival()).toEqual({ id: 'docker', at: 1_000 })
  })

  it('announces only the id that is new when others are already active', () => {
    observe(['docker'])
    vi.setSystemTime(2_000)
    observe(['usage-session', 'docker'])
    expect(arrival()).toEqual({ id: 'usage-session', at: 2_000 })
  })

  it('re-announces an id that cleared and then came back', () => {
    observe(['docker'])
    observe([])
    vi.setSystemTime(3_000)
    observe(['docker'])
    expect(arrival()).toEqual({ id: 'docker', at: 3_000 })
  })

  it('keeps the last arrival when ids only clear', () => {
    observe(['docker', 'update'])
    vi.setSystemTime(4_000)
    observe(['update'])
    expect(arrival()).toEqual({ id: 'docker', at: 1_000 })
  })
})
