import { useEffect, useRef, useState } from 'react'
import type { LatestUsage, UsageSnapshot } from '@/types/api'
import {
  buildLinePoints,
  buildProjectionLine,
  nearestSnapshotByTime,
  xFor,
  yFor,
  USAGE_RANGES,
  USAGE_RANGE_MS,
  type UsageRange,
} from './sparkline'

export type UsageMetric = 'session' | 'weekly'

// Session and weekly resets happen on very different timescales (hours vs.
// days), so each metric gets its own default range and its own "how far
// into the future is a projected cutoff still worth drawing" window —
// a weekly cutoff routinely projects days out, where a session one is
// usually hours.
const METRIC: Record<
  UsageMetric,
  {
    title: string
    label: string
    pctOf: (s: UsageSnapshot) => number
    cutoffOf: (l: LatestUsage) => number | null
    defaultRange: UsageRange
    futureWindowMs: number
  }
> = {
  session: {
    title: 'Session usage',
    label: 'session',
    pctOf: (s) => s.sessionPct,
    cutoffOf: (l) => l.sessionCutoffAt,
    defaultRange: '24h',
    futureWindowMs: 6 * 60 * 60 * 1000,
  },
  weekly: {
    title: 'Weekly usage',
    label: 'week',
    pctOf: (s) => s.weeklyPct,
    cutoffOf: (l) => l.weeklyCutoffAt,
    defaultRange: '7d',
    futureWindowMs: 2 * 24 * 60 * 60 * 1000,
  },
}

const GRID_PCTS = [100, 75, 50, 25, 0]

function fmtAxisTime(ts: number, range: UsageRange): string {
  const d = new Date(ts)
  if (range === '1h' || range === '24h') {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

interface Hover {
  x: number
  y: number
  snapshot: UsageSnapshot
}

export function UsageChart({ latest, metric }: { latest: LatestUsage; metric: UsageMetric }) {
  const config = METRIC[metric]
  const [range, setRange] = useState<UsageRange>(config.defaultRange)
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>([])
  const [hover, setHover] = useState<Hover | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const to = Date.now()
    const from = to - USAGE_RANGE_MS[range]
    window.api.usageGetRange(from, to, 200).then((data) => {
      if (!cancelled) setSnapshots(data)
    })
    return () => {
      cancelled = true
    }
  }, [range, latest.ts])

  const now = Date.now()
  const from = now - USAGE_RANGE_MS[range]
  const cutoffAt = config.cutoffOf(latest)
  const to = cutoffAt != null && cutoffAt <= now + config.futureWindowMs ? Math.max(now, cutoffAt) : now

  const linePoints = buildLinePoints(snapshots, from, to, config.pctOf)
  const projection = buildProjectionLine(snapshots[snapshots.length - 1], config.pctOf, cutoffAt, from, to)

  function handlePointer(clientX: number) {
    const el = plotRef.current
    if (!el || snapshots.length < 2) return
    const rect = el.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const ts = from + pct * (to - from)

    const first = snapshots[0].ts
    const last = snapshots[snapshots.length - 1].ts
    if (ts < first || ts > last) {
      setHover(null)
      return
    }

    const snapshot = nearestSnapshotByTime(snapshots, ts)
    if (!snapshot) return
    setHover({ x: xFor(snapshot.ts, from, to), y: yFor(config.pctOf(snapshot)), snapshot })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-fg-muted uppercase tracking-wider font-semibold">{config.title}</div>
        <div className="flex items-center gap-1">
          {USAGE_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={r === range}
              className={[
                'px-2 py-1 text-xs rounded border transition-colors',
                r === range
                  ? 'border-fg-muted bg-white/5 text-fg'
                  : 'border-border text-fg-muted hover:text-fg hover:bg-white/5 hover:border-fg-muted',
              ].join(' ')}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {linePoints ? (
        <>
          <div className="flex gap-2 h-72">
            <div className="flex flex-col justify-between text-xs text-fg-subtle text-right leading-none">
              {GRID_PCTS.map((p) => (
                <span key={p}>{p}%</span>
              ))}
            </div>
            <div
              ref={plotRef}
              data-testid="chart-plot"
              className="relative flex-1 touch-none"
              onPointerDown={(e) => handlePointer(e.clientX)}
              onPointerMove={(e) => {
                if (e.buttons || e.pointerType === 'touch') handlePointer(e.clientX)
              }}
              onPointerLeave={() => setHover(null)}
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                <g stroke="var(--color-border)" strokeWidth="0.5" vectorEffect="non-scaling-stroke">
                  {GRID_PCTS.map((p) => (
                    <line key={p} x1="0" y1={100 - p} x2="100" y2={100 - p} strokeDasharray="1.5 2" />
                  ))}
                </g>
                <polyline
                  points={linePoints}
                  fill="none"
                  stroke="rgb(var(--color-accent))"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {projection && (
                  <line
                    data-testid="projection-line"
                    x1={projection.x1}
                    y1={projection.y1}
                    x2={projection.x2}
                    y2={projection.y2}
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {hover && (
                  <line
                    x1={hover.x}
                    y1="0"
                    x2={hover.x}
                    y2="100"
                    stroke="var(--color-fg-muted)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
              {hover && (
                <div
                  data-testid="chart-tooltip"
                  className="absolute -translate-y-full bg-popover border border-border rounded px-2 py-1 text-xs shadow-lg pointer-events-none whitespace-nowrap"
                  style={{
                    left: `${hover.x}%`,
                    top: `${hover.y}%`,
                    transform: hover.x < 20 ? 'translateY(-110%)' : hover.x > 80 ? 'translateY(-110%) translateX(-100%)' : 'translateY(-110%) translateX(-50%)',
                  }}
                >
                  <div className="text-fg-muted">{fmtAxisTime(hover.snapshot.ts, range)}</div>
                  <div className="text-fg font-semibold">{config.pctOf(hover.snapshot)}% {config.label}</div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs text-fg-subtle pl-8">
            <span>{fmtAxisTime(from, range)}</span>
            <span>{fmtAxisTime(to, range)}</span>
          </div>
        </>
      ) : (
        <div className="h-72 flex items-center justify-center text-xs text-fg-muted">Not enough history yet for this range</div>
      )}
    </div>
  )
}
