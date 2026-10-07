import { useEffect, useState } from 'react'

// Lives in the footer's far-right corner at every window width (VIDE-140) —
// full text colour rather than fg-subtle, which read at ~2.7:1 and was hard
// to see at a glance.
export function Clock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span data-testid="footer-clock" className="shrink-0 text-fg font-medium select-none tabular-nums">
      {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </span>
  )
}
