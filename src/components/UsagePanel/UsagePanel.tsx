import { useEffect, useState } from 'react'
import type { LatestUsage } from '@/types/api'
import { formatBurnRate, formatCountdown, formatResetTime } from './format'

const RADIUS = 38
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function Gauge({ pct, label }: { pct: number | null; label: string }) {
  const clamped = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  const offset = CIRCUMFERENCE * (1 - clamped / 100)

  return (
    <svg viewBox="0 0 100 100" width={92} height={92}>
      <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth="9" />
      <circle
        cx="50"
        cy="50"
        r={RADIUS}
        fill="none"
        stroke="rgb(var(--color-accent))"
        strokeWidth="9"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="50" y="47" textAnchor="middle" fill="var(--color-fg)" fontSize="20" fontWeight="700">
        {pct == null ? '—' : `${pct}%`}
      </text>
      <text x="50" y="63" textAnchor="middle" fill="var(--color-fg-muted)" fontSize="8.5" letterSpacing="0.5">
        {label}
      </text>
    </svg>
  )
}

function ResetRow({ label, resetAt, ratePerHour, now }: {
  label: string
  resetAt: number | null
  ratePerHour: number | null
  now: number
}) {
  return (
    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
      <div>
        <div className="text-xs text-fg-muted">{label}</div>
        <div className="text-sm text-fg font-medium">{formatResetTime(resetAt)}</div>
        <div className="text-xs text-accent font-mono">{formatCountdown(resetAt, now)}</div>
      </div>
      <div className="text-right">
        <div className="text-sm text-fg font-mono">{formatBurnRate(ratePerHour)}</div>
        <div className="text-[0.625rem] text-fg-muted uppercase tracking-wider">burn rate</div>
      </div>
    </div>
  )
}

export function UsagePanel() {
  const [latest, setLatest] = useState<LatestUsage | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let cancelled = false
    window.api.usageAcquire()
    window.api.usageGetLatest().then((data) => { if (!cancelled) setLatest(data) })
    const unsubscribe = window.api.onUsageUpdate((data) => setLatest(data))

    return () => {
      cancelled = true
      unsubscribe()
      window.api.usageRelease()
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="shrink-0 border-t border-border bg-sidebar px-4 py-3">
      {latest ? (
        <>
          <div className="flex items-center justify-around">
            <Gauge pct={latest.sessionPct} label="SESSION" />
            <Gauge pct={latest.weeklyPct} label="THIS WEEK" />
          </div>
          <div className="mt-3 divide-y divide-border">
            <ResetRow label="Session resets" resetAt={latest.sessionResetAt} ratePerHour={latest.sessionAvgRatePerHour} now={now} />
            <ResetRow label="Week resets" resetAt={latest.weeklyResetAt} ratePerHour={latest.weeklyAvgRatePerHour} now={now} />
          </div>
        </>
      ) : (
        <p className="text-xs text-fg-muted text-center py-4">No usage data yet</p>
      )}
    </div>
  )
}
