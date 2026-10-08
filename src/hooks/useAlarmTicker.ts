import { useEffect } from 'react'
import { useAlarmStore } from '@/stores/alarmStore'

const TICK_MS = 1000

// Rings any alarm that came due since the previous tick (VIDE-141). Mounted
// once, by the StatusBar. The first tick starts from mount time, so alarms
// that went off while vIDE was closed don't all ring at launch; a late tick
// (e.g. waking from sleep) still rings what came due during the gap.
export function useAlarmTicker() {
  useEffect(() => {
    let last = Date.now()
    const interval = setInterval(() => {
      const now = Date.now()
      useAlarmStore.getState().checkDue(last, now)
      last = now
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [])
}
