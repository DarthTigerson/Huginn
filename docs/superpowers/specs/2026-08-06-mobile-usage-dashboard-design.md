# Claude Usage mobile page: persisted history, refresh control, reset timing, burn rate, real dashboard grid

## Problem
The current Claude Usage phone page (just rebuilt in
`2026-08-06-mobile-web-rebuild-design.md`) has an in-memory-only,
last-60-polls chart that resets on every Huginn restart, a fixed 60s poll
interval with no control, no visibility into exactly when the session/weekly
limits reset, no sense of how fast usage is trending, and a single fixed
centered column that wastes most of the screen on anything wider than a
phone (per the laptop-browser screenshot).

`claude /usage --output-format json`'s `result` text already contains the
exact reset time, previously unparsed:
```
Current session: 0% used · resets Aug 7 at 4:20am (Europe/Malta)
Current week (all models): 9% used · resets Aug 13 at 10am (Europe/Malta)
```
The reported zone is always the machine's own local zone (confirmed:
`Intl.DateTimeFormat().resolvedOptions().timeZone` on this machine is also
`Europe/Malta`), so these can be parsed as plain local date-times — no
timezone-conversion library needed.

## Design

### Persisted history (kept forever, never pruned)
`UsagePoller` gains a `historyFile` path
(`app.getPath('userData')/usage-history.jsonl`, JSON Lines — append-only,
no full-file rewrite per poll). Each poll appends one line; nothing is ever
deleted, per your call to keep it forever.

Given "forever" retention, the file is not fully loaded into memory —
`UsagePoller` only keeps the single latest snapshot in memory for instant
`getLatest()`. Any ranged read (`getRange(fromTs, toTs, maxPoints)`) reads
the JSONL file fresh, filters to the window, and downsamples (bucket-average)
to at most `maxPoints` (~120) before returning — the same shape of trade-off
Grafana itself makes (raw storage kept, but queries return an
aggregated/decimated series sized to what a chart can actually show). This
keeps responses fast and small regardless of how much history has
accumulated, without ever discarding the underlying data. Reading a plain
JSONL file with `readFileSync` + `split('\n')` is trivial at the scale a
personal single-machine tool will realistically produce (this mirrors how
`MobileServer` already re-reads static files from disk per-request, by
design, elsewhere in this codebase) — not worth streaming/indexing
infrastructure tonight.

### Refresh-rate control, changeable from the phone
`UsagePoller` gets `setIntervalMs(ms)` / `getIntervalMs()`, restricted to a
preset list (`15_000 | 30_000 | 60_000 | 300_000 | 900_000`, default
`60_000` — unchanged from today). The choice is persisted to
`app.getPath('userData')/usage-settings.json` and reloaded on startup, so it
survives restarts.

New endpoint `POST /api/usage/interval` with body `{ms}` validates against
the preset list and calls `setIntervalMs`. `/api/state` gains
`pollIntervalMs` so the phone reflects the real current value on load. The
usage page gets a small "Refresh rate" panel: five buttons (15s/30s/1m/5m/
15m), current one highlighted, posts on tap.

### Session/weekly reset timing
`parseUsageText` (`electron/usagePoller.ts`) gains a regex for
`resets (\w+) (\d+) at (\d+):(\d+)(am|pm)` per line, producing
`sessionResetAt`/`weeklyResetAt` as epoch ms (local-time `Date`
construction, per the timezone note above; `null` if unparseable — display
falls back to "—" rather than guessing).

The usage page shows both the exact time (e.g. "Resets Aug 7, 4:20am") and a
live countdown ("2h 14m"), computed client-side from the epoch timestamp
against `Date.now()` and re-rendered every second — no server round-trip
needed for the ticking part.

### Average burn rate
Claude's session window is a fixed 5 hours and the weekly window a fixed 7
days (the limits' documented cadence, not something derived from history).
Given that and `resetAt`, elapsed-time-in-window is `windowHours -
hoursRemaining`, so:
```
avgRatePctPerHour = currentPct / elapsedHoursInWindow
```
computed for both session (5h window) and week (7d window), shown as e.g.
"≈0.4%/hr". Guarded against the first couple of minutes of a window
(elapsed near zero) by showing "—" until elapsed ≥ 5 minutes, avoiding a
wild/meaningless spike. This needs no historical lookback and is correct
from the very first poll of a fresh session.

### Dashboard-style responsive grid ("similar to Grafana")
Replace the single fixed `max-width: 400px` centered column and the one
hand-picked landscape breakpoint with a real fluid grid:
```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: clamp(12px, 2vw, 20px);
}
```
Each card (gauges, stats, resets+burn-rate, refresh-rate, skills) is a grid
item and reflows on its own — one column on a phone, several on a tablet or
the laptop-browser case from the screenshot — with no JS and no
per-device-class breakpoints to maintain. The time-series chart card spans
the full row width (`grid-column: 1 / -1`) so it always gets the most
space, matching how Grafana's own big time-series panel typically spans a
dashboard row. `.dashboard` replaces `.page` as the usage page's root
layout (pin/home pages keep the simple centered `.page` — they're
single-purpose, not dashboards).

### Chart time range
The chart gets a small range selector — 1h / 24h / 7d / 30d (default 24h) —
each tab re-fetching `/api/usage?range=...`, which calls
`poller.getRange(...)` server-side. The existing lightweight hand-rolled SVG
polyline rendering is kept (no charting library) — it just gets fed the
downsampled series for the selected range instead of a hardcoded "last 60
polls".

### API summary
- `GET /api/usage?range=1h|24h|7d|30d` → `{ latest, snapshots }` (snapshots
  downsampled to the range).
- `POST /api/usage/interval` `{ms}` → sets the poll interval.
- `GET /api/state` gains `pollIntervalMs`.
- `UsageSnapshot` gains `sessionResetAt: number | null`,
  `weeklyResetAt: number | null`.

## Out of scope
- No querying of arbitrary custom time ranges beyond the four presets.
- No file rotation/compaction of the JSONL history (explicitly: keep
  forever, per your answer).
- No multi-machine aggregation — history is local to the machine running
  Huginn, same as today.

## Testing
- `parseUsageText` gains cases for reset-time parsing (extend the existing
  coverage if any, else add unit tests) including a missing/unparseable
  reset line.
- `UsagePoller.getRange` downsampling: a test asserting a range with more
  raw points than `maxPoints` returns a bucketed/averaged series of the
  right length, and a range with fewer points returns them unchanged.
- `UsagePoller.setIntervalMs` persists and reloads from
  `usage-settings.json`.
- `MobileServer` tests extended: `/api/usage/interval` updates the poller
  and is reflected in `/api/state`.
