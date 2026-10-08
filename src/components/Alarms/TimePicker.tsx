import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const MINUTES = Array.from({ length: 60 }, (_, m) => m)

// The alarm time field (VIDE-141, mockup "T1"): one HH:MM field whose panel
// has an hours column and a minutes column side by side. The native time
// input's picker can't be themed, and two separate dropdowns could both be
// open at once. Picking an hour keeps the panel open; picking a minute
// finishes and closes it, as do an outside click and Escape.
export function TimePicker({ id, hour, minute, onChange }: {
  id?: string
  hour: number
  minute: number
  onChange: (hour: number, minute: number) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hoursRef = useRef<HTMLDivElement>(null)
  const minutesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Open on the current time, centred in each column, not at 00.
  useLayoutEffect(() => {
    if (!open) return
    for (const column of [hoursRef.current, minutesRef.current]) {
      const selected = column?.querySelector<HTMLElement>('[aria-selected="true"]')
      if (column && selected) column.scrollTop = selected.offsetTop - column.clientHeight / 2 + selected.clientHeight / 2
    }
  }, [open])

  const option = (value: number, selected: boolean, onPick: () => void) => (
    <button
      key={value}
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={[
        'h-[26px] shrink-0 rounded text-sm tabular-nums transition-colors',
        selected ? 'bg-accent text-on-accent font-semibold' : 'text-fg-muted hover:bg-white/5 hover:text-fg',
      ].join(' ')}
    >
      {pad(value)}
    </button>
  )

  return (
    <div ref={wrapperRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={[
          'h-[1.875rem] min-w-[5.5rem] flex items-center justify-between gap-2 rounded-lg border bg-bg pl-2.5 pr-2 text-sm text-fg tabular-nums transition-colors',
          open ? 'border-accent/60' : 'border-border hover:border-accent/60',
        ].join(' ')}
      >
        <span>{pad(hour)}:{pad(minute)}</span>
        <ClockIcon />
      </button>

      {open && (
        <div
          data-testid="time-picker-panel"
          className="absolute right-0 top-full mt-1 z-50 w-[8.5rem] rounded border border-border bg-popover p-1.5 shadow-2xl shadow-black/50"
        >
          <div className="grid grid-cols-2 gap-1">
            <div className="pb-1 text-center text-[0.625rem] font-semibold uppercase tracking-wider text-fg-subtle">Hour</div>
            <div className="pb-1 text-center text-[0.625rem] font-semibold uppercase tracking-wider text-fg-subtle">Min</div>
            <div ref={hoursRef} role="listbox" aria-label="Hour" className="relative flex h-48 flex-col gap-0.5 overflow-y-auto pr-0.5">
              {HOURS.map((h) => option(h, h === hour, () => onChange(h, minute)))}
            </div>
            <div ref={minutesRef} role="listbox" aria-label="Minute" className="relative flex h-48 flex-col gap-0.5 overflow-y-auto pr-0.5">
              {MINUTES.map((m) => option(m, m === minute, () => {
                onChange(hour, m)
                setOpen(false)
              }))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClockIcon() {
  return (
    <svg className="shrink-0 text-fg-muted" width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
