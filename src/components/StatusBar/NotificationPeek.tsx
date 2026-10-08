import { useState } from 'react'
import { useVisibleNotificationItems } from '@/hooks/useVisibleNotificationItems'
import { useNotificationArrival } from '@/hooks/useNotificationArrival'
import { useNotificationPanelStore } from '@/stores/notificationPanelStore'
import { useNotificationAcknowledgedStore } from '@/stores/notificationAcknowledgedStore'
import type { NotificationArrival } from '@/stores/notificationArrivalStore'

// How long the peek stays up; matches the `notification-peek-drain`
// keyframes duration in index.css.
export const PEEK_MS = 5000
// Extra time kept mounted after PEEK_MS so it can fade out (duration-200).
const CLOSE_TRANSITION_MS = 200

// A brief look at a newly arrived notification (VIDE-140), shown where the
// notification panel opens — above the bell — then closing by itself.
// Unlike the panel, closing on its own does NOT acknowledge anything: the
// bell stays filled until the user actually opens the panel. Hovering
// holds it open. Full width only (hidden below 1200px), where the bell's
// ring and count are the whole signal.
export function NotificationPeek() {
  const panelOpen = useNotificationPanelStore((s) => s.open)
  const togglePanel = useNotificationPanelStore((s) => s.toggle)
  const acknowledge = useNotificationAcknowledgedStore((s) => s.acknowledge)
  const visibleItems = useVisibleNotificationItems()
  const showing = useNotificationArrival(PEEK_MS)
  const mounted = useNotificationArrival(PEEK_MS + CLOSE_TRANSITION_MS)
  const [held, setHeld] = useState<NotificationArrival | null>(null)

  const arrival = held ?? mounted
  // Looked up among visible (unacknowledged) items, so the peek goes away
  // as soon as the item is seen in the panel or its condition clears.
  const item = arrival ? visibleItems.find((i) => i.id === arrival.id) : undefined
  if (!arrival || !item || panelOpen) return null
  const closing = !held && !showing
  const others = visibleItems.length - 1

  return (
    <div
      key={arrival.at}
      data-testid="notification-peek"
      data-notification-toggle=""
      onMouseEnter={() => setHeld(arrival)}
      onMouseLeave={() => setHeld(null)}
      className={[
        'notification-peek absolute bottom-full right-0 mb-[3px] w-[28rem] max-w-[92vw] z-40 hidden min-[1200px]:block',
        'overflow-hidden rounded-t border border-b-0 border-border bg-popover shadow-lg shadow-black/40',
        'transition-[opacity,transform] duration-200 ease-out',
        closing ? 'opacity-0 translate-y-1 pointer-events-none' : 'opacity-100 translate-y-0',
      ].join(' ')}
    >
      <div className="flex items-center">
        <button
          type="button"
          disabled={item.disabled}
          // mouseup rather than onClick (VIDE-91), same as the panel rows.
          onMouseUp={(e) => {
            if (e.button !== 0) return
            item.onClick?.()
            acknowledge([item.id])
            setHeld(null)
          }}
          className={[
            'flex flex-1 min-w-0 items-center gap-2 text-left px-3 py-1.5 text-xs transition-colors',
            item.disabled ? 'text-fg-subtle cursor-default' : 'text-fg hover:bg-white/5 cursor-pointer',
          ].join(' ')}
        >
          <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="shrink-0 text-accent [&_svg]:h-3.5 [&_svg]:w-3.5">{item.icon}</span>
          <span className="truncate">{item.text}</span>
        </button>
        {others > 0 && (
          <button
            type="button"
            onMouseUp={(e) => {
              if (e.button !== 0) return
              setHeld(null)
              togglePanel()
            }}
            className="shrink-0 px-3 py-1.5 text-xs text-fg-muted hover:text-fg transition-colors"
          >
            +{others} more
          </button>
        )}
      </div>
      <div className="notification-peek-drain h-px w-full bg-accent/70" />
    </div>
  )
}
