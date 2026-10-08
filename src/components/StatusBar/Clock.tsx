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
    <span data-testid="footer-clock" className="shrink-0 text-sm leading-none text-fg font-medium select-none tabular-nums">
      {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </span>
  )
}
