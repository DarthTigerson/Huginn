export function formatResetTime(ts: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  )
}

export function formatCountdown(ts: number | null, now = Date.now()): string {
  if (!ts) return '—'
  const diff = ts - now
  if (diff <= 0) return 'now'
  const totalMin = Math.floor(diff / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function formatBurnRate(ratePerHour: number | null): string {
  return ratePerHour == null ? '—' : `≈${ratePerHour.toFixed(2)}%/hr`
}
