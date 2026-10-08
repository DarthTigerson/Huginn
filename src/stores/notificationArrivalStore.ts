import { create } from 'zustand'

export interface NotificationArrival {
  // Every id that became active in the same observe() — usually one, but
  // e.g. two conditions noticed in the same render arrive together.
  ids: string[]
  at: number
  // Increments per arrival — identifies one even when two land in the same
  // millisecond, where `at` alone can't tell them apart.
  seq: number
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
// bell's ring and the peek above it both key off `arrival`, so they fire
// together exactly once per newly-appeared notification.
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
      ...(fresh.length > 0 ? { arrival: { ids: fresh, at: Date.now(), seq: (get().arrival?.seq ?? 0) + 1 } } : {}),
    })
  },
}))
