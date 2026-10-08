import { create } from 'zustand'
import { SNOOZE_MS, firesBetween, nextDateFor, type Alarm } from '@/lib/alarmSchedule'

// Deliberately NOT under any vIDE Sync prefix (configRepoStore's
// CATEGORY_PREFIXES): alarms are per-machine, and every snooze rewrites this
// key, which would otherwise mean a sync commit per snooze (VIDE-119).
const ALARMS_KEY = 'vide:alarms'
// Written on every stop/snooze so other windows end the same ring. Only
// the `storage` event matters — the value is never read back on load.
const HANDLED_KEY = 'vide:alarms:handled'

export interface AlarmRinging {
  alarmId: string
  since: number
}

// A Once alarm's date is worked out here (nextDateFor), not chosen.
export type NewAlarm = Pick<Alarm, 'name' | 'hour' | 'minute' | 'repeat' | 'days'>

interface AlarmStore {
  alarms: Alarm[]
  ringing: AlarmRinging | null
  addAlarm: (alarm: NewAlarm) => void
  setEnabled: (id: string, enabled: boolean) => void
  // Ignores a blank name, so an alarm always keeps one.
  renameAlarm: (id: string, name: string) => void
  removeAlarm: (id: string) => void
  // Called by the footer ticker with its previous and current tick.
  checkDue: (from: number, to: number) => void
  ring: (id: string) => void
  snooze: () => void
  stop: () => void
}

function isAlarm(value: unknown): value is Alarm {
  const a = value as Alarm
  return !!a && typeof a.id === 'string' && typeof a.name === 'string' &&
    typeof a.hour === 'number' && typeof a.minute === 'number' &&
    typeof a.repeat === 'boolean' && Array.isArray(a.days)
}

function loadAlarms(): Alarm[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ALARMS_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter(isAlarm).map((a) => ({ ...a, date: a.date ?? null, enabled: a.enabled !== false, snoozedUntil: a.snoozedUntil ?? null }))
      : []
  } catch {
    return []
  }
}

function saveAlarms(alarms: Alarm[]) {
  localStorage.setItem(ALARMS_KEY, JSON.stringify(alarms))
}

const sortByTime = (alarms: Alarm[]) => [...alarms].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useAlarmStore = create<AlarmStore>((set, get) => {
  const update = (alarms: Alarm[]) => {
    saveAlarms(alarms)
    set({ alarms })
  }
  const announceHandled = (alarmId: string) => {
    localStorage.setItem(HANDLED_KEY, JSON.stringify({ alarmId, at: Date.now() }))
  }

  return {
    alarms: loadAlarms(),
    ringing: null,

    addAlarm: (input) => {
      const alarm: Alarm = {
        id: newId(),
        name: input.name.trim(),
        hour: input.hour,
        minute: input.minute,
        repeat: input.repeat,
        days: input.repeat ? [...input.days] : [],
        date: input.repeat ? null : nextDateFor(input.hour, input.minute, Date.now()),
        enabled: true,
        snoozedUntil: null,
      }
      update(sortByTime([...get().alarms, alarm]))
    },

    setEnabled: (id, enabled) => {
      update(get().alarms.map((a) => {
        if (a.id !== id) return a
        if (!enabled) return { ...a, enabled, snoozedUntil: null }
        // Switching a Once alarm back on means its next occurrence, not the
        // (probably past) date it originally rang on.
        return { ...a, enabled, date: a.repeat ? a.date : nextDateFor(a.hour, a.minute, Date.now()) }
      }))
      if (!enabled && get().ringing?.alarmId === id) set({ ringing: null })
    },

    renameAlarm: (id, name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      update(get().alarms.map((a) => (a.id === id ? { ...a, name: trimmed } : a)))
    },

    removeAlarm: (id) => {
      update(get().alarms.filter((a) => a.id !== id))
      if (get().ringing?.alarmId === id) set({ ringing: null })
    },

    checkDue: (from, to) => {
      if (get().ringing) return
      const due = get().alarms.find((a) => firesBetween(a, from, to))
      if (due) get().ring(due.id)
    },

    ring: (id) => {
      // A snooze that's now firing is used up.
      update(get().alarms.map((a) => (a.id === id ? { ...a, snoozedUntil: null } : a)))
      set({ ringing: { alarmId: id, since: Date.now() } })
    },

    snooze: () => {
      const ringing = get().ringing
      if (!ringing) return
      const until = Date.now() + SNOOZE_MS
      update(get().alarms.map((a) => (a.id === ringing.alarmId ? { ...a, snoozedUntil: until } : a)))
      set({ ringing: null })
      announceHandled(ringing.alarmId)
    },

    stop: () => {
      const ringing = get().ringing
      if (!ringing) return
      // A once alarm is done; a repeating one waits for its next day.
      update(get().alarms.map((a) => (a.id === ringing.alarmId ? { ...a, snoozedUntil: null, enabled: a.repeat ? a.enabled : false } : a)))
      set({ ringing: null })
      announceHandled(ringing.alarmId)
    },
  }
})

// Other vIDE windows share localStorage: keep their alarm list current, and
// end a ring here once it's been stopped or snoozed over there.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (e) => {
    if (e.key === ALARMS_KEY) {
      useAlarmStore.setState({ alarms: loadAlarms() })
    } else if (e.key === HANDLED_KEY && e.newValue) {
      try {
        const handled = JSON.parse(e.newValue) as { alarmId: string; at: number }
        const ringing = useAlarmStore.getState().ringing
        if (ringing && ringing.alarmId === handled.alarmId && handled.at >= ringing.since) {
          useAlarmStore.setState({ ringing: null })
        }
      } catch {
        // ignore a malformed value
      }
    }
  })
}
