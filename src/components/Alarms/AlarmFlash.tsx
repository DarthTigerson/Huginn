import { useAlarmStore } from '@/stores/alarmStore'

// Mockup "B2 — Edge flare" (VIDE-141): comets drip from the center of the
// footer's top edge out to both sides, each growing and brightening as it
// travels, and the far edges flare as each one arrives. Lines only, on the
// same edge as the git-activity bar, in the theme's primary colour. Timing
// lives in index.css (.alarm-flash-*); COMETS must match the staggered
// delays there.
const COMETS = 4

export function AlarmFlash() {
  const ringing = useAlarmStore((s) => s.ringing)
  if (!ringing) return null

  const side = (dir: 'l' | 'r') => (
    <div className={`alarm-flash-half alarm-flash-${dir}`}>
      {Array.from({ length: COMETS }, (_, i) => (
        <span key={i} className="alarm-flash-comet" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
      <span className="alarm-flash-edge" />
    </div>
  )

  return (
    <div data-testid="alarm-flash" className="alarm-flash">
      {side('l')}
      {side('r')}
    </div>
  )
}
