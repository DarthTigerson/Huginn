import { useEffect, useState } from 'react'

// Lives in the footer's far-right corner at every window width (VIDE-140) —
// full text colour rather than fg-subtle, which read at ~2.7:1 and was hard
// to see at a glance. text-sm with leading-none: one step larger than the
// rest of the footer while still fitting its fixed h-6 height.
export function Clock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    // h-5 like the bell's wrapper, so the hover panel below can use the same
    // offset as the notification peek to sit on the footer's top edge.
    <span className="group relative flex h-5 items-center">
      <span data-testid="footer-clock" className="shrink-0 text-sm leading-none text-fg font-medium select-none tabular-nums">
        {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </span>
      {/* Styled like NotificationPeek: popover panel on the footer's top edge. */}
      <span
        role="tooltip"
        className={[
          'pointer-events-none absolute bottom-full -right-3 z-40 mb-[3px] flex items-center gap-2 whitespace-nowrap',
          'rounded-t border border-b-0 border-border bg-popover px-3 py-1.5 text-xs text-fg shadow-lg shadow-black/40',
          'opacity-0 translate-y-1 transition-[opacity,transform] duration-200 ease-out delay-150',
          'group-hover:opacity-100 group-hover:translate-y-0',
        ].join(' ')}
      >
        <span className="shrink-0 text-accent [&_svg]:h-3.5 [&_svg]:w-3.5">
          <CalendarIcon />
        </span>
        {formatLongDate(now)}
      </span>
    </span>
  )
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// "Wednesday the 8th of October"
export function formatLongDate(date: Date): string {
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' })
  const month = date.toLocaleDateString('en-GB', { month: 'long' })
  return `${weekday} the ${ordinal(date.getDate())} of ${month}`
}

function ordinal(day: number): string {
  const teen = day % 100 >= 11 && day % 100 <= 13
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th'
  return `${day}${suffix}`
}
