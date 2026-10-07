import { useNotificationArrival } from '@/hooks/useNotificationArrival'

// Matches the `notification-pulse-growth` keyframes duration in index.css.
const PULSE_MS = 1350

// One-shot white strip along the footer's top edge when a new notification
// arrives (VIDE-140) — same shape and timing as GitActivityBar's running
// strip, so the footer has one visual language for "something happened".
// Keyed on the arrival time so back-to-back arrivals each replay it.
export function NotificationPulse() {
  const arrival = useNotificationArrival(PULSE_MS)
  if (!arrival) return null
  return <div key={arrival.at} data-testid="notification-pulse" className="notification-pulse" />
}
