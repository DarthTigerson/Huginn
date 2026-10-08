import { useUpdateStore } from '@/stores/updateStore'
import { useStatusMessageStore } from '@/stores/statusMessageStore'

// The footer's center (VIDE-140). Empty most of the time — the clock lives
// in the right corner, the bell (with its count) is the notification
// toggle, and a new notification peeks above the bell (NotificationPeek).
// The center only speaks up for a transient status message or the
// "up to date" confirmation.
export function FooterMessage() {
  const transientMessage = useStatusMessageStore((s) => s.message)
  const upToDateVersion = useUpdateStore((s) => s.upToDateVersion)

  const positionClasses = 'absolute left-1/2 -translate-x-1/2 max-w-[45%] truncate text-xs'

  if (transientMessage) {
    return (
      <span className={[positionClasses, 'text-accent select-none pointer-events-none'].join(' ')}>
        {transientMessage}
      </span>
    )
  }

  if (upToDateVersion) {
    return (
      <span className={[positionClasses, 'text-accent select-none pointer-events-none'].join(' ')}>
        {`You're on the latest version — v${upToDateVersion}`}
      </span>
    )
  }

  return null
}
