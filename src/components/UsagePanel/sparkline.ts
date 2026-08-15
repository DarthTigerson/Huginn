// Same 0-100 x 0-100 viewBox trick as the mobile usage chart
// (electron/mobileWeb/usage.js): x is "percent of the way through the
// window" by timestamp, y is "100 minus pct used" so the SVG can be
// stretched to fill whatever box it's given with preserveAspectRatio="none".
export function xFor(ts: number, from: number, to: number): number {
  if (to === from) return 0
  return ((ts - from) / (to - from)) * 100
}

export function yFor(pct: number): number {
  return 100 - pct
}

interface HasTimestamp {
  ts: number
}

// pctOf is an accessor rather than a fixed field name so the same chart math
// drives both the session and weekly usage charts (UsageChart's `metric`
// prop) without duplicating this module.
export function buildLinePoints<T extends HasTimestamp>(snapshots: T[], from: number, to: number, pctOf: (s: T) => number): string {
  if (snapshots.length < 2) return ''
  return snapshots.map((s) => `${xFor(s.ts, from, to).toFixed(2)},${yFor(pctOf(s)).toFixed(2)}`).join(' ')
}

export interface ProjectionLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

// The dashed "at this rate, you'll hit 100% here" segment. Only drawn when
// the cutoff actually falls inside the visible window — off-screen numbers
// aren't a useful graph annotation, the numeric estimate covers that case.
export function buildProjectionLine<T extends HasTimestamp>(
  lastSnapshot: T | undefined,
  pctOf: (s: T) => number,
  cutoffAt: number | null,
  from: number,
  to: number
): ProjectionLine | null {
  if (!lastSnapshot || cutoffAt == null) return null
  if (cutoffAt < from || cutoffAt > to) return null
  return {
    x1: xFor(lastSnapshot.ts, from, to),
    y1: yFor(pctOf(lastSnapshot)),
    x2: xFor(cutoffAt, from, to),
    y2: yFor(100),
  }
}

export const USAGE_RANGES = ['1h', '24h', '7d', '30d'] as const
export type UsageRange = (typeof USAGE_RANGES)[number]

export const USAGE_RANGE_MS: Record<UsageRange, number> = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
}

// For the chart crosshair — which real snapshot is closest to wherever the
// pointer landed. Earlier snapshot wins an exact tie.
export function nearestSnapshotByTime<T extends { ts: number }>(snapshots: T[], ts: number): T | undefined {
  let best: T | undefined
  let bestDiff = Infinity
  for (const s of snapshots) {
    const diff = Math.abs(s.ts - ts)
    if (diff < bestDiff) {
      bestDiff = diff
      best = s
    }
  }
  return best
}
