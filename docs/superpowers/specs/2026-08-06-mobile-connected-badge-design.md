# Mobile connected-device badge

## Problem
The Mobile Display panel tracks `connectedCount` in local component state
(`MobileDisplayPanel.tsx`), so the number of connected phones is only visible
when that panel is open. `App.tsx`, which renders the sidebar `ActivityBar`,
has no access to it and can't show a badge on the Phone icon the way it
already does for uncommitted git changes (`gitBadge` → `ActivityBarItem.badge`).

## Design
Lift mobile connection state out of the panel into a small Zustand store,
`src/stores/mobileStore.ts`, following the existing `cosmosSettingsStore`
pattern:

- State: the `MobileState` object (`running`, `port`, `localIp`, `pin`,
  `qrSvg`, `connectedCount`, `allowingNewDevice`).
- `init()`: fetches the current state via `window.api.mobileGetState()` and
  subscribes to `window.api.onMobileState()` for push updates. Guarded by an
  `initialized` flag so calling it more than once (e.g. from both `App.tsx`
  and the panel) doesn't register duplicate IPC listeners.

`MobileDisplayPanel.tsx` switches from its local `useState`/`useEffect` pair
to reading from this store and calling `init()` on mount, instead of
`window.api.mobileGetState()`/`onMobileState()` directly. Behavior is
unchanged from the user's perspective.

`App.tsx` calls `useMobileStore.getState().init()` once alongside its other
store initializations, and computes:

```ts
const mobileBadge = mobileState.running && mobileState.connectedCount > 0
  ? mobileState.connectedCount
  : undefined
```

This is passed as `badge={mobileBadge}` on the `mobile` `ActivityBarItem`,
reusing the existing badge rendering in `ActivityBar.tsx` (same small circle
already used for the git changed-file count) — no new UI component needed.

## Out of scope
- No cap/truncation (e.g. "99+") for the device count — unlike git changes,
  realistic device counts won't need it.
- No changes to the mobile server/pairing flow itself.

## Testing
- Existing `MobileDisplayPanel.test.tsx` continues to pass by mocking
  `window.api` the same way; store swap is behavior-preserving.
- Add a small test for `mobileStore` covering `init()` fetching state and
  applying pushed updates.
