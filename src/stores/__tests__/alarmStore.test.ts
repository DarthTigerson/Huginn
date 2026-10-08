// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useAlarmStore } from '../alarmStore'
import { SNOOZE_MS } from '@/lib/alarmSchedule'

const NOW = new Date(2026, 9, 8, 9, 29, 59).getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  localStorage.clear()
  useAlarmStore.setState({ alarms: [], ringing: null })
})

afterEach(() => {
  vi.useRealTimers()
})

const addStandup = (over: Partial<Parameters<ReturnType<typeof useAlarmStore.getState>['addAlarm']>[0]> = {}) =>
  useAlarmStore.getState().addAlarm({ name: '  Stand-up ', hour: 9, minute: 30, repeat: true, days: [4], ...over })

describe('alarmStore', () => {
  it('adds an alarm (trimmed name, enabled) and persists it locally', () => {
    addStandup()
    const [a] = useAlarmStore.getState().alarms
    expect(a.name).toBe('Stand-up')
    expect(a.enabled).toBe(true)
    expect(JSON.parse(localStorage.getItem('vide:alarms')!)).toHaveLength(1)
  })

  it('keeps alarms sorted by time of day', () => {
    addStandup({ name: 'Lunch', hour: 12, minute: 45 })
    addStandup()
    expect(useAlarmStore.getState().alarms.map((a) => a.name)).toEqual(['Stand-up', 'Lunch'])
  })

  it('checkDue rings an alarm that came due between ticks', () => {
    addStandup()
    useAlarmStore.getState().checkDue(NOW, NOW + 2000)
    expect(useAlarmStore.getState().ringing?.alarmId).toBe(useAlarmStore.getState().alarms[0].id)
  })

  it('snooze ends the ring and rings again 9 minutes later', () => {
    addStandup()
    const store = useAlarmStore.getState()
    store.checkDue(NOW, NOW + 2000)
    vi.setSystemTime(NOW + 2000)
    useAlarmStore.getState().snooze()
    expect(useAlarmStore.getState().ringing).toBeNull()
    const until = useAlarmStore.getState().alarms[0].snoozedUntil!
    expect(until).toBe(NOW + 2000 + SNOOZE_MS)

    useAlarmStore.getState().checkDue(until - 1000, until)
    expect(useAlarmStore.getState().ringing).not.toBeNull()
    // the snooze is used up once it fires
    expect(useAlarmStore.getState().alarms[0].snoozedUntil).toBeNull()
  })

  it('switching a once alarm back on moves it to its next occurrence', () => {
    addStandup({ name: 'Dentist', repeat: false, days: [] })
    const id = useAlarmStore.getState().alarms[0].id
    useAlarmStore.setState((st) => ({ alarms: st.alarms.map((a) => ({ ...a, date: '2026-10-01', enabled: false })) }))
    useAlarmStore.getState().setEnabled(id, true)
    // 09:30 is still ahead of NOW (09:29:59) -> today
    expect(useAlarmStore.getState().alarms[0].date).toBe('2026-10-08')
  })

  it('stop switches a once alarm off, but leaves a repeating one on', () => {
    addStandup({ name: 'Dentist', repeat: false, days: [] })
    useAlarmStore.getState().checkDue(NOW, NOW + 2000)
    useAlarmStore.getState().stop()
    expect(useAlarmStore.getState().alarms[0].enabled).toBe(false)

    useAlarmStore.setState({ alarms: [], ringing: null })
    addStandup()
    useAlarmStore.getState().checkDue(NOW, NOW + 2000)
    useAlarmStore.getState().stop()
    expect(useAlarmStore.getState().alarms[0].enabled).toBe(true)
  })

  it('does not stack a second ring while one is ringing', () => {
    addStandup()
    addStandup({ name: 'Other' })
    useAlarmStore.getState().checkDue(NOW, NOW + 2000)
    const first = useAlarmStore.getState().ringing
    useAlarmStore.getState().checkDue(NOW, NOW + 2000)
    expect(useAlarmStore.getState().ringing).toBe(first)
  })

  it('disabling or deleting the ringing alarm ends the ring', () => {
    addStandup()
    const id = useAlarmStore.getState().alarms[0].id
    useAlarmStore.getState().ring(id)
    useAlarmStore.getState().setEnabled(id, false)
    expect(useAlarmStore.getState().ringing).toBeNull()
    useAlarmStore.getState().ring(id)
    useAlarmStore.getState().removeAlarm(id)
    expect(useAlarmStore.getState().ringing).toBeNull()
  })

  it('a stop in another window ends the ring here too', () => {
    addStandup()
    const id = useAlarmStore.getState().alarms[0].id
    useAlarmStore.getState().ring(id)
    window.dispatchEvent(new StorageEvent('storage', { key: 'vide:alarms:handled', newValue: JSON.stringify({ alarmId: id, at: Date.now() + 1 }) }))
    expect(useAlarmStore.getState().ringing).toBeNull()
  })
})
