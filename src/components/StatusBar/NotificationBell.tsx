import { useNotificationItems } from '@/hooks/useNotificationItems'
import { useVisibleNotificationItems } from '@/hooks/useVisibleNotificationItems'
import { useNotificationArrival } from '@/hooks/useNotificationArrival'
import { useNotificationPanelStore } from '@/stores/notificationPanelStore'
import { BellIcon } from '@/components/ActivityBar/ActivityBar'

// Matches the `notification-bell-ring` keyframes duration in index.css.
const RING_MS = 900

// The footer's notification toggle at every window width (VIDE-140): bell
// and count fused into one pill so they read as a single thing. Filled
// accent while anything is unread (not yet acknowledged by closing the
// panel on it), a plain outline once everything has been seen, and just a
// muted bell with nothing active. Count = every active notification, seen
// or not — the same rows the panel lists.
export function NotificationBell() {
  const items = useNotificationItems()
  const visibleItems = useVisibleNotificationItems()
  const toggle = useNotificationPanelStore((s) => s.toggle)
  const ringing = useNotificationArrival(RING_MS)
  const count = items.length
  const unread = visibleItems.length > 0

  return (
    <button
      type="button"
      data-testid="notification-bell"
      // NotificationPanel ignores outside-mousedowns that land on this, so
      // clicking the bell while the panel is open toggles it shut instead
      // of closing on mousedown and immediately reopening on mouseup.
      data-notification-toggle=""
      disabled={count === 0}
      // mouseup rather than onClick (VIDE-91): a ticking usage countdown
      // re-renders this every second, which can break click synthesis.
      onMouseUp={(e) => {
        if (count > 0 && e.button === 0) toggle()
      }}
      title="Notifications"
      aria-label={count > 0 ? `${count} notification${count === 1 ? '' : 's'}` : 'Notifications'}
      className={[
        'flex h-5 shrink-0 items-center justify-center gap-1 rounded-full border text-[11px] font-semibold tabular-nums transition-colors [&_svg]:h-3 [&_svg]:w-3',
        count === 0
          ? 'w-5 border-border bg-bg text-fg-subtle cursor-default'
          : unread
            ? 'pl-[5px] pr-[7px] border-accent bg-accent text-on-accent cursor-pointer'
            : 'pl-[5px] pr-[7px] border-border bg-bg text-fg-muted hover:text-fg hover:border-fg-subtle cursor-pointer',
      ].join(' ')}
    >
      <span key={ringing?.at} className={ringing ? 'notification-bell-ring flex' : 'flex'}>
        <BellIcon />
      </span>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}
