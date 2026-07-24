# Claude Usage Pipeline + Mobile Chart — Design Spec

**Date:** 2026-07-24
**Status:** Approved
**Sub-projects:** 2 (data pipeline) + 3 (mobile UI) of the Mobile Display feature

## Overview

A background `UsagePoller` periodically runs `claude /usage --output-format json`, parses the result text, and accumulates snapshots in memory. The existing `MobileServer` exposes a `/api/usage` JSON endpoint and a full `/app/claude-usage` HTML page with live arc gauges and a line chart. The phone page self-refreshes every 60 seconds.

---

## Data Pipeline (`electron/usagePoller.ts`)

### Invocation

```bash
<login-shell> -lc 'claude /usage --output-format json'
```

Uses `child_process.execFile` with the user's `$SHELL` and the `-lc` (login, command) flag so the correct PATH (Homebrew, nvm, etc.) is inherited. Times out after 15 seconds.

The JSON response has a `result` string field containing the human-readable usage text. We parse that text with regexes.

### Parsed fields

```ts
interface UsageSnapshot {
  ts: number                               // Date.now()
  sessionPct: number                       // "Current session: 12% used"
  weeklyPct: number                        // "Current week (all models): 2% used"
  requests24h: number                      // "Last 24h · 58 requests"
  requests7d: number                       // "Last 7d · 91 requests"
  topSkills: { name: string; pct: number }[] // top skills from Last 24h block
}
```

### Storage

- Last 60 snapshots kept in memory (= 1 hour at 60s interval, via ring-buffer with `shift`)
- No disk persistence — snapshots are scoped to the current server-on session
- First poll fires immediately on `start()`; subsequent polls every 60 seconds

### Class interface

```ts
class UsagePoller {
  start(): void          // begins polling
  stop(): void           // clears interval; snapshots retained in memory
  getSnapshots(): UsageSnapshot[]
  getLatest(): UsageSnapshot | null
}
```

`parseUsageText(text: string)` is exported as a pure function for testability.

---

## MobileServer changes (`electron/mobile.ts`)

- `MobileServer` owns a `UsagePoller` instance
- `start()` calls `poller.start()`; `stop()` / `dispose()` call `poller.stop()`
- Two new routes (both require session auth):

| Route | Response |
|-------|----------|
| `GET /app/claude-usage` | Full HTML page with charts |
| `GET /api/usage` | `{ snapshots: UsageSnapshot[], latest: UsageSnapshot \| null }` |

The existing 501 stub for `/app/claude-usage` is replaced.

---

## Mobile UI — `/app/claude-usage`

Self-contained inline HTML+JS page. No CDN dependencies — all SVG, vanilla JS.

### Layout

1. **Back link** + title + "last updated" time (top row)
2. **Two arc gauges** side by side — Session % and Weekly % — SVG circles with `stroke-dashoffset` animation
3. **Line chart** — session % over the last N snapshots, with a subtle fill area below the line
4. **Two stat tiles** — "Requests today" and "This week" as large numbers
5. **Top skills list** — name + percentage from last 24h

### Update loop

On load and every 60 seconds:
```
fetch('/api/usage') → render(data)
```

`render()` surgically updates SVG attributes and text nodes — no DOM rebuild.

### Arc gauge math

`r = 38`, `circumference = 2π × 38 ≈ 238.76`  
`stroke-dashoffset = circumference × (1 − pct/100)`

### Line chart math

`viewBox="0 0 280 60"`. For each snapshot `i` of `N`:  
`x = (i / (N−1)) × 280`  
`y = height − 4 − (sessionPct / maxPct) × (height − 8)`

---

## Testing

- Unit test `parseUsageText()` with a fixture string matching real `claude /usage` output
- Update `MobileDisplayPanel.test.tsx` mock to include `mobileAddDevice`
- No integration test for the full HTTP + poller flow (manual test on device)

---

## What this spec does NOT cover

- Disk persistence of snapshots across app restarts
- Historical data beyond the current in-memory window
- Multiple Claude accounts or workspaces
