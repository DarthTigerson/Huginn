// Pure scheduling for silent alarms (VIDE-141) — no store, no timers, so it
// can be unit-tested with plain dates.

export interface Alarm {
  id: string
  name: string
  hour: number // 0-23
  minute: number // 0-59
  // true: rings on `days` (0 = Sunday … 6 = Saturday) every week.
  // false: rings once, on `date` (local YYYY-MM-DD).
  repeat: boolean
  days: number[]
  date: string | null
  enabled: boolean
  // Epoch ms of a pending snooze; it replaces the next regular occurrence
  // until it fires or the alarm is stopped/disabled.
  snoozedUntil: number | null
}

export const SNOOZE_MS = 9 * 60 * 1000

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The date a Once alarm should ring on: today if the time is still ahead,
// otherwise tomorrow. Once alarms have no date picker — they always mean
// "the next time it's this o'clock".
export function nextDateFor(hour: number, minute: number, now: number): string {
  const today = new Date(now)
  const at = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute, 0, 0)
  if (at.getTime() > now) return isoDate(today)
  return isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
}

function onceAt(alarm: Alarm): number | null {
  if (!alarm.date) return null
  const [y, m, d] = alarm.date.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, alarm.hour, alarm.minute, 0, 0).getTime()
}

// The next time strictly after `after` that this alarm rings, or null
// (disabled, a once alarm already past, or a repeat with no days).
export function nextOccurrence(alarm: Alarm, after: number): number | null {
  if (!alarm.enabled) return null
  if (alarm.snoozedUntil !== null && alarm.snoozedUntil > after) return alarm.snoozedUntil
  if (!alarm.repeat) {
    const at = onceAt(alarm)
    return at !== null && at > after ? at : null
  }
  if (alarm.days.length === 0) return null
  const base = new Date(after)
  // 8 days covers "later today" through "same weekday next week".
  for (let add = 0; add < 8; add++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + add, alarm.hour, alarm.minute, 0, 0)
    if (day.getTime() > after && alarm.days.includes(day.getDay())) return day.getTime()
  }
  return null
}

// Whether the alarm rings at some moment in (from, to]. The ticker calls
// this with its previous and current tick, so an alarm fires exactly once
// even if a tick is late — and nothing scheduled before launch fires on
// startup, since the first tick starts from "now".
export function firesBetween(alarm: Alarm, from: number, to: number): boolean {
  const next = nextOccurrence(alarm, from)
  return next !== null && next <= to
}

// The soonest upcoming alarm, for the footer icon / tooltip and the page.
export function nextAlarm(alarms: Alarm[], now: number): { alarm: Alarm; at: number } | null {
  let best: { alarm: Alarm; at: number } | null = null
  for (const alarm of alarms) {
    const at = nextOccurrence(alarm, now)
    if (at !== null && (!best || at < best.at)) best = { alarm, at }
  }
  return best
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Monday-first, matching the day buttons on the Alarms page.
const mondayFirst = (day: number) => (day + 6) % 7

export function repeatLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => mondayFirst(a) - mondayFirst(b))
  const key = [...days].sort((a, b) => a - b).join(',')
  if (sorted.length === 7) return 'Every day'
  if (key === '1,2,3,4,5') return 'Weekdays'
  if (key === '0,6') return 'Weekends'
  return sorted.map((d) => DAY_SHORT[d]).join(', ')
}

export function onceLabel(date: string, now: Date): string {
  const today = isoDate(now)
  const tomorrow = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  if (date === today) return 'Once · today'
  if (date === tomorrow) return 'Once · tomorrow'
  const [y, m, d] = date.split('-').map(Number)
  return 'Once · ' + new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Whether times are shown with AM/PM here — the same default the footer
// clock and alarm rows use (toLocaleTimeString with no options), so the
// time picker can match them. Picking from a 00–23 list while everything
// else read "AM/PM" made "10" mean 10 AM to someone setting 10 PM.
export function uses12HourClock(locale?: string): boolean {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 ?? false
}

export function formatAlarmTime(hour: number, minute: number): string {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// "in 1 h 12 min" / "in 5 min"
export function formatTimeUntil(at: number, now: number): string {
  const mins = Math.max(1, Math.round((at - now) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h >= 24) {
    const days = Math.floor(h / 24)
    return `in ${days} day${days === 1 ? '' : 's'}`
  }
  return h > 0 ? `in ${h} h ${m} min` : `in ${m} min`
}
