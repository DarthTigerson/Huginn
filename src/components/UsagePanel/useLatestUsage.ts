import { useEffect, useState } from 'react'
import type { LatestUsage } from '@/types/api'

// Shared between the compact bottom panel and the full Usage Graph tab —
// both need the same acquire/release refcounting (see UsageManager) around
// the poller, so this lives in one place rather than being duplicated with
// a chance to drift.
export function useLatestUsage(): LatestUsage | null {
  const [latest, setLatest] = useState<LatestUsage | null>(null)

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

  return latest
}
