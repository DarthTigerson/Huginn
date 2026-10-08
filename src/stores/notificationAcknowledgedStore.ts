import { create } from 'zustand'

interface NotificationAcknowledgedState {
  // Ids the user has already seen (closed the panel while they were showing)
  // — hidden from the footer/panel until reconcile() drops them, which only
  // happens once the underlying condition clears. That's what makes a later
  // re-trigger of the same id show up again instead of staying silenced.
  acknowledgedIds: string[]
  // Ids cleared with the panel's × / "Dismiss all" (VIDE-94, VIDE-140):
  // dropped from the panel AND the bell's count, not just marked seen.
  // Shared here rather than kept inside the panel so the bell agrees —
  // otherwise clearing everything still left the old count on the bell.
  // Same lifetime as acknowledgedIds: reconcile() forgets an id once its
  // condition clears, so a later re-trigger shows up again.
  dismissedIds: string[]
  acknowledge: (ids: string[]) => void
  // Dismissing also acknowledges.
  dismiss: (ids: string[]) => void
  reconcile: (activeIds: string[]) => void
}

export const useNotificationAcknowledgedStore = create<NotificationAcknowledgedState>((set, get) => ({
  acknowledgedIds: [],
  dismissedIds: [],

  acknowledge: (ids) => {
    const next = new Set(get().acknowledgedIds)
    for (const id of ids) next.add(id)
    set({ acknowledgedIds: Array.from(next) })
  },

  dismiss: (ids) => {
    const acknowledged = new Set(get().acknowledgedIds)
    const dismissed = new Set(get().dismissedIds)
    for (const id of ids) {
      acknowledged.add(id)
      dismissed.add(id)
    }
    set({ acknowledgedIds: Array.from(acknowledged), dismissedIds: Array.from(dismissed) })
  },

  reconcile: (activeIds) => {
    const active = new Set(activeIds)
    const { acknowledgedIds, dismissedIds } = get()
    const nextAcknowledged = acknowledgedIds.filter((id) => active.has(id))
    const nextDismissed = dismissedIds.filter((id) => active.has(id))
    if (nextAcknowledged.length !== acknowledgedIds.length || nextDismissed.length !== dismissedIds.length) {
      set({ acknowledgedIds: nextAcknowledged, dismissedIds: nextDismissed })
    }
  },
}))
