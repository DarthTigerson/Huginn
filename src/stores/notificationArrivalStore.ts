import { create } from 'zustand'

export interface NotificationArrival {
  id: string
  at: number
}

interface NotificationArrivalState {
  // Ids active as of the last observe() — an id only counts as "arrived"
  // when it's missing from here, so a condition that stays active never
  // re-announces itself, while one that clears and later re-triggers does
  // (it was dropped from this list when it cleared).
  knownIds: string[]
  arrival: NotificationArrival | null
  observe: (activeIds: string[]) => void
}

// Drives the footer's "something new happened" moment (VIDE-140): the
// temporary center teaser, the bell's ring and the white pulse along the
// footer's top edge all key off `arrival`, so they fire together exactly
// once per newly-appeared notification.
export const useNotificationArrivalStore = create<NotificationArrivalState>((set, get) => ({
  knownIds: [],
  arrival: null,

  observe: (activeIds) => {
    const { knownIds } = get()
    const known = new Set(knownIds)
    const fresh = activeIds.filter((id) => !known.has(id))
    const sameIds = fresh.length === 0 && activeIds.length === knownIds.length
    if (sameIds) return
    set({
      knownIds: [...activeIds],
      ...(fresh.length > 0 ? { arrival: { id: fresh[0], at: Date.now() } } : {}),
    })
  },
}))
