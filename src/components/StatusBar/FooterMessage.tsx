import { useUpdateStore } from '@/stores/updateStore'
import { useStatusMessageStore } from '@/stores/statusMessageStore'
import { useNotificationPanelStore } from '@/stores/notificationPanelStore'
import { useVisibleNotificationItems } from '@/hooks/useVisibleNotificationItems'
import { useNotificationArrival } from '@/hooks/useNotificationArrival'

// Matches the `notification-teaser` keyframes duration in index.css.
export const TEASER_MS = 6000

// The footer's center (VIDE-140). Empty most of the time — the clock lives
// in the right corner and the bell (with its count) is the notification
// toggle. The center only speaks up for a transient status message, the
// "up to date" confirmation, or for TEASER_MS after a new notification
// arrives, when that notification's text shows here. The teaser is
// full-width only (hidden below 1200px): at half width the bell's ring and
// count are the whole signal.
export function FooterMessage() {
  const transientMessage = useStatusMessageStore((s) => s.message)
  const upToDateVersion = useUpdateStore((s) => s.upToDateVersion)
  const visibleItems = useVisibleNotificationItems()
  const toggleNotificationPanel = useNotificationPanelStore((s) => s.toggle)
  const arrival = useNotificationArrival(TEASER_MS)

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

  // Looked up among the *visible* (unacknowledged) items, so opening the
  // panel on it — or the condition clearing — ends the teaser early.
  const arrived = arrival ? visibleItems.find((item) => item.id === arrival.id) : undefined
  if (!arrival || !arrived) return null
  const others = visibleItems.length - 1

  return (
    <button
      // Keyed on the arrival so a second notification restarts the
      // fade/drain animation instead of inheriting the first one's progress.
      key={arrival.at}
      type="button"
      data-testid="notification-teaser"
      data-notification-toggle=""
      // onMouseUp rather than onClick (VIDE-91): a usage countdown re-renders
      // this every second, and a click straddling a re-render can fail the
      // browser's same-target check that click synthesis depends on.
      onMouseUp={(e) => {
        if (e.button === 0) toggleNotificationPanel()
      }}
      className="notification-teaser absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden min-[1200px]:flex h-5 max-w-[45%] items-center gap-2 overflow-hidden rounded-full border border-accent bg-bg pl-2 pr-3 text-xs text-accent cursor-pointer [&_svg]:h-3 [&_svg]:w-3"
    >
      <span className="shrink-0 flex">{arrived.icon}</span>
      <span className="truncate">{arrived.text}</span>
      {others > 0 && <span className="shrink-0 text-fg-muted">+{others}</span>}
      <span className="notification-teaser-drain absolute left-0 bottom-0 h-px w-full bg-accent/70" />
    </button>
  )
}
