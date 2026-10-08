import { useEffect, useState } from 'react'
import { useAlarmStore } from '@/stores/alarmStore'
import {
  formatAlarmTime,
  onceLabel,
  repeatLabel,
  type Alarm,
} from '@/lib/alarmSchedule'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS = [1, 2, 3, 4, 5]

// Same uppercase label as the settings pages' Section headings.
function SectionLabel({ children }: { children: string }) {
  return <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">{children}</h2>
}

// The Alarms tab (VIDE-141), opened from the footer clock or "View: Alarms".
// Header like the settings pages; the alarms sit in one bordered list and
// the new-alarm form in a dashed box, as in the agreed mockup.
export function AlarmsPage() {
  const alarms = useAlarmStore((s) => s.alarms)
  const ringing = useAlarmStore((s) => s.ringing)

  // Re-render periodically so "Once · today" and "Snoozed until" stay true.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">Alarms</h1>
      <p className="text-sm text-fg-muted mb-6">
        Silent reminders. When one goes off, the footer flashes and a popup lets you snooze it for 9 minutes or stop it. No sound.
      </p>

      <div className="flex flex-col gap-8 max-w-[48rem]">
        <section>
          <SectionLabel>Your alarms</SectionLabel>
          {alarms.length === 0 ? (
            <p className="text-sm text-fg-subtle">No alarms yet. Add one below.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
              {alarms.map((alarm) => <AlarmRow key={alarm.id} alarm={alarm} ringing={ringing?.alarmId === alarm.id} now={now} />)}
            </div>
          )}
        </section>

        <section>
          <SectionLabel>New alarm</SectionLabel>
          <div className="rounded-lg border border-dashed border-border p-4">
            <NewAlarmForm />
          </div>
        </section>
      </div>
    </div>
  )
}

function AlarmRow({ alarm, ringing, now }: { alarm: Alarm; ringing: boolean; now: number }) {
  const setEnabled = useAlarmStore((s) => s.setEnabled)
  const removeAlarm = useAlarmStore((s) => s.removeAlarm)
  const [time, period] = splitTime(formatAlarmTime(alarm.hour, alarm.minute))

  const status = ringing ? (
    <span className="text-accent">Ringing now</span>
  ) : alarm.enabled && alarm.snoozedUntil !== null && alarm.snoozedUntil > now ? (
    <span className="text-accent">
      Snoozed until {new Date(alarm.snoozedUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </span>
  ) : (
    <span>{alarm.repeat ? repeatLabel(alarm.days) : onceLabel(alarm.date ?? '', new Date(now))}</span>
  )

  return (
    <div
      data-testid="alarm-row"
      className={['flex items-center gap-5 px-4 py-2.5', ringing ? 'bg-accent/10' : 'bg-sidebar'].join(' ')}
    >
      <div className={['text-2xl font-light tabular-nums shrink-0', alarm.enabled ? 'text-fg' : 'text-fg-subtle'].join(' ')}>
        {time}
        {period && <span className="ml-1 text-sm font-medium text-fg-muted">{period}</span>}
      </div>
      <div className="min-w-0 flex-1 text-xs text-fg-muted">
        <div className={['truncate text-sm font-medium', alarm.enabled ? 'text-fg' : 'text-fg-subtle'].join(' ')}>{alarm.name}</div>
        {status}
      </div>
      <button
        type="button"
        role="switch"
        aria-label={`${alarm.name} on`}
        aria-checked={alarm.enabled}
        onClick={() => setEnabled(alarm.id, !alarm.enabled)}
        className={[
          'relative shrink-0 w-9 h-5 rounded-full border transition-colors',
          alarm.enabled ? 'bg-accent border-accent/80' : 'bg-white/10 border-white/15',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow ring-1 ring-black/10 transition-transform',
            alarm.enabled ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
      <button
        type="button"
        aria-label={`Delete ${alarm.name}`}
        title="Delete"
        onClick={() => removeAlarm(alarm.id)}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-fg-subtle hover:text-fg hover:bg-white/10"
      >
        ×
      </button>
    </div>
  )
}

function NewAlarmForm() {
  const addAlarm = useAlarmStore((s) => s.addAlarm)
  const [name, setName] = useState('')
  const [time, setTime] = useState('09:00')
  const [repeat, setRepeat] = useState(false)
  const [days, setDays] = useState<number[]>(WEEKDAYS)

  const canAdd = name.trim().length > 0 && /^\d{2}:\d{2}$/.test(time) && (!repeat || days.length > 0)

  const submit = () => {
    if (!canAdd) return
    const [hour, minute] = time.split(':').map(Number)
    addAlarm({ name, hour, minute, repeat, days })
    setName('')
  }

  const inputClass = 'h-8 px-2 text-sm text-fg bg-bg border border-border rounded-lg focus:outline-none focus:border-accent/60'

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1 flex-1 min-w-[12rem]">
          <label htmlFor="alarm-name" className="text-xs text-fg-muted">Name</label>
          <input id="alarm-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stand-up, Lunch" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="alarm-time" className="text-xs text-fg-muted">Time</label>
          <input id="alarm-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="How often" className="flex rounded-full border border-border bg-bg overflow-hidden">
          {[{ value: false, label: 'Once' }, { value: true, label: 'Repeat' }].map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={repeat === opt.value}
              onClick={() => setRepeat(opt.value)}
              className={[
                'h-7 px-3 text-xs transition-colors',
                repeat === opt.value ? 'bg-accent text-on-accent font-semibold' : 'text-fg-muted hover:text-fg',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {repeat && (
          <>
            <div className="flex gap-1">
              {DAY_LETTERS.map((letter, day) => {
                const on = days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-label={DAY_NAMES[day]}
                    aria-pressed={on}
                    onClick={() => setDays((prev) => (on ? prev.filter((d) => d !== day) : [...prev, day]))}
                    className={[
                      'w-7 h-7 rounded-full border text-xs transition-colors',
                      on ? 'bg-accent border-accent text-on-accent font-semibold' : 'bg-bg border-border text-fg-muted hover:text-fg',
                    ].join(' ')}
                  >
                    {letter}
                  </button>
                )
              })}
            </div>
            <span className="text-xs text-fg-subtle">{days.length ? repeatLabel(days) : 'Pick at least one day'}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canAdd}
          className="h-8 px-4 rounded-full bg-accent text-on-accent text-xs font-semibold transition-opacity disabled:opacity-40 disabled:cursor-default"
        >
          Add alarm
        </button>
        {!name.trim() && <span className="text-xs text-fg-subtle">Give it a name to add it</span>}
      </div>
    </form>
  )
}

// "9:30 AM" -> ["9:30", "AM"]; a 24-hour locale has no period.
function splitTime(formatted: string): [string, string] {
  const match = formatted.match(/^(.*?)\s*([AaPp]\.?[Mm]\.?)$/)
  return match ? [match[1], match[2]] : [formatted, '']
}
