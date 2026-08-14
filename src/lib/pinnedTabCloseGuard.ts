export interface PendingClose {
  path: string
  at: number
}

const DEFAULT_THRESHOLD_MS = 500

// Pinned tabs exist specifically to survive accidental closes, so a single
// Cmd+W shouldn't take one out - it takes two presses on the SAME pinned
// tab within the threshold. Pure decision function (no timers/Date.now()
// inside) so the double-press window logic is testable without real delays;
// the caller supplies `now` and persists `nextPending` between calls.
export function evaluateCmdWForPinnedTab(
  path: string,
  isPinned: boolean,
  pending: PendingClose | null,
  now: number,
  thresholdMs: number = DEFAULT_THRESHOLD_MS
): { shouldClose: boolean; nextPending: PendingClose | null } {
  if (!isPinned) return { shouldClose: true, nextPending: null }
  if (pending && pending.path === path && now - pending.at <= thresholdMs) {
    return { shouldClose: true, nextPending: null }
  }
  return { shouldClose: false, nextPending: { path, at: now } }
}
