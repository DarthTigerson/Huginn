import { describe, it, expect } from 'vitest'
import { nextOccurrence, nextDateFor, firesBetween, nextAlarm, repeatLabel, onceLabel, formatTimeUntil, SNOOZE_MS, type Alarm } from '../alarmSchedule'

// Thursday 8 October 2026, 10:00 local
const NOW = new Date(2026, 9, 8, 10, 0, 0).getTime()
const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m, 0, 0).getTime()

const alarm = (over: Partial<Alarm>): Alarm => ({
  id: 'a', name: 'Stand-up', hour: 9, minute: 30, repeat: true, days: [1, 2, 3, 4, 5],
  date: null, enabled: true, snoozedUntil: null, ...over,
})

describe('nextOccurrence', () => {
  it('repeat: skips today when the time has passed, lands on the next chosen day', () => {
    expect(nextOccurrence(alarm({}), NOW)).toBe(at(9, 9, 30)) // Friday
  })

  it('repeat: later today when the time is still ahead', () => {
    expect(nextOccurrence(alarm({ hour: 12, minute: 45 }), NOW)).toBe(at(8, 12, 45))
  })

  it('repeat: wraps over the weekend', () => {
    // Friday 9 Oct 18:00 -> Monday 12 Oct
    expect(nextOccurrence(alarm({}), at(9, 18, 0))).toBe(at(12, 9, 30))
  })

  it('repeat with no days never rings', () => {
    expect(nextOccurrence(alarm({ days: [] }), NOW)).toBeNull()
  })

  it('once: rings on its date, and not after it has passed', () => {
    const once = alarm({ repeat: false, days: [], date: '2026-10-09', hour: 15, minute: 0 })
    expect(nextOccurrence(once, NOW)).toBe(at(9, 15, 0))
    expect(nextOccurrence(once, at(9, 15, 1))).toBeNull()
  })

  it('a disabled alarm never rings', () => {
    expect(nextOccurrence(alarm({ enabled: false }), NOW)).toBeNull()
  })

  it('a pending snooze takes priority over the regular time', () => {
    const snoozedUntil = NOW + SNOOZE_MS
    expect(nextOccurrence(alarm({ snoozedUntil }), NOW)).toBe(snoozedUntil)
  })
})

describe('nextDateFor', () => {
  it('is today while the time is still ahead, tomorrow once it has passed', () => {
    expect(nextDateFor(12, 0, NOW)).toBe('2026-10-08')
    expect(nextDateFor(9, 0, NOW)).toBe('2026-10-09')
    expect(nextDateFor(10, 0, NOW)).toBe('2026-10-09') // exactly now counts as passed
  })

  it('rolls over the end of a month', () => {
    expect(nextDateFor(8, 0, new Date(2026, 9, 31, 9, 0).getTime())).toBe('2026-11-01')
  })
})

describe('firesBetween', () => {
  it('fires for an occurrence inside (from, to]', () => {
    const a = alarm({ hour: 10, minute: 0 })
    expect(firesBetween(a, NOW - 1000, NOW)).toBe(true)
  })

  it('does not fire for one exactly at `from` (already handled by the previous tick)', () => {
    const a = alarm({ hour: 10, minute: 0 })
    expect(firesBetween(a, NOW, NOW + 1000)).toBe(false)
  })

  it('a late tick still catches what came due during the gap', () => {
    const a = alarm({ hour: 10, minute: 0 })
    expect(firesBetween(a, NOW - 60 * 60 * 1000, NOW + 5000)).toBe(true)
  })
})

describe('nextAlarm', () => {
  it('picks the soonest enabled alarm', () => {
    const lunch = alarm({ id: 'lunch', name: 'Lunch', hour: 12, minute: 45 })
    const standup = alarm({ id: 'standup' })
    expect(nextAlarm([standup, lunch], NOW)?.alarm.id).toBe('lunch')
  })

  it('is null when nothing is on', () => {
    expect(nextAlarm([alarm({ enabled: false })], NOW)).toBeNull()
  })
})

describe('labels', () => {
  it('names common repeat sets', () => {
    expect(repeatLabel([1, 2, 3, 4, 5])).toBe('Weekdays')
    expect(repeatLabel([6, 0])).toBe('Weekends')
    expect(repeatLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day')
    expect(repeatLabel([5, 1])).toBe('Mon, Fri')
    expect(repeatLabel([0, 1, 3])).toBe('Mon, Wed, Sun') // Monday first, Sunday last
  })

  it('describes once dates relative to today', () => {
    const today = new Date(NOW)
    expect(onceLabel('2026-10-08', today)).toBe('Once · today')
    expect(onceLabel('2026-10-09', today)).toBe('Once · tomorrow')
    expect(onceLabel('2026-10-14', today)).toMatch(/^Once · Wed/)
  })

  it('formats time until', () => {
    expect(formatTimeUntil(NOW + 5 * 60000, NOW)).toBe('in 5 min')
    expect(formatTimeUntil(NOW + 72 * 60000, NOW)).toBe('in 1 h 12 min')
    expect(formatTimeUntil(NOW + 3 * 24 * 3600000, NOW)).toBe('in 3 days')
  })
})
