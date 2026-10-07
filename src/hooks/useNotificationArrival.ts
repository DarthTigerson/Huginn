import { useEffect, useState } from 'react'
import { useNotificationItems } from './useNotificationItems'
import { useNotificationArrivalStore, type NotificationArrival } from '@/stores/notificationArrivalStore'

// Returns the latest notification arrival while it's younger than
// `windowMs`, then null — re-rendering on its own when the window runs out.
// Every caller also feeds the current ids into the arrival store; that's
// idempotent (a second observe() of the same ids is a no-op), so the
// teaser, bell and pulse can each call this without coordinating.
export function useNotificationArrival(windowMs: number): NotificationArrival | null {
  const items = useNotificationItems()
  const observe = useNotificationArrivalStore((s) => s.observe)
  const arrival = useNotificationArrivalStore((s) => s.arrival)

  const idsKey = items.map((i) => i.id).join(',')
  useEffect(() => {
    observe(idsKey ? idsKey.split(',') : [])
  }, [idsKey, observe])

  const [, setExpired] = useState(0)
  const remaining = arrival ? arrival.at + windowMs - Date.now() : 0
  useEffect(() => {
    if (!arrival || remaining <= 0) return
    const timer = setTimeout(() => setExpired((n) => n + 1), remaining)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival, windowMs])

  return arrival && remaining > 0 ? arrival : null
}
