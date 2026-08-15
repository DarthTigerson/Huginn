import type { LatestUsage } from '@/types/api'

export function UsageSkills({ topSkills }: { topSkills: LatestUsage['topSkills'] }) {
  if (topSkills.length === 0) {
    return <p className="text-xs text-fg-muted">No data yet</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {topSkills.map((s) => (
        <div key={s.name} className="flex items-center gap-3">
          <span className="text-xs text-fg-muted flex-1 truncate">{s.name}</span>
          <div className="h-[3px] rounded-full bg-accent shrink-0" style={{ width: `${Math.round(s.pct * 1.8)}px` }} />
          <span className="text-xs font-bold text-accent w-8 text-right">{s.pct}%</span>
        </div>
      ))}
    </div>
  )
}
