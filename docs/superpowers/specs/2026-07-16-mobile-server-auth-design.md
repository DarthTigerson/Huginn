# Mobile Server + Auth — Design Spec

**Date:** 2026-07-16
**Status:** Approved
**Sub-project:** 1 of 3 (Mobile Display feature)

## Overview

A local HTTP server embedded in the Electron main process lets a phone connect to Huginn and display live developer stats. This spec covers the server lifecycle, PIN-based authentication, QR code display, and the basic mobile web shell (PIN entry + app list). The Claude Usage data pipeline and charts are covered in sub-projects 2 and 3.

---

## Architecture

```
MobileDisplayPanel (renderer)
    ↕ IPC (mobile:start / mobile:stop / mobile:getState / mobile:state event)
MobileServer (electron/mobile.ts)
    ↕ http.Server on port 7842
Phone browser
```

`MobileServer` follows the same manager pattern as `ClaudeManager` and `PtyManager`: constructor accepts `BrowserWindow`, exposes `registerHandlers()`, instantiated in `main.ts`.

No new server framework — Node.js built-in `http` module only. One new runtime dep: `qrcode` (for SVG generation, no transitive deps of note).

---

## MobileServer (`electron/mobile.ts`)

### Lifecycle

- `start()`: binds `http.Server` to port 7842 (tries 7843, 7844 on EADDRINUSE), generates first PIN, starts 15s rotation interval, generates QR SVG, pushes `mobile:state` to renderer.
- `stop()`: closes server, clears interval, clears sessions, pushes updated `mobile:state`.
- Server stays alive until explicitly stopped or the app quits.

### PIN

- 5-digit zero-padded string (`Math.random`, seeded fresh each rotation).
- Rotates every 15 seconds via `setInterval`.
- On rotation: new PIN generated, `mobile:state` pushed to renderer. Existing sessions remain valid (only new connection attempts require the new PIN).
- 2-second grace window: server also accepts the *previous* PIN to handle race conditions at rotation boundary.

### Session auth

- `POST /auth` validates PIN → generates a `crypto.randomUUID()` token → stores in `Set<string>` in memory → sets `Set-Cookie: session=<token>; HttpOnly; SameSite=Strict; Path=/`.
- Subsequent requests include the cookie; server reads it and checks against the set.
- Sessions live until server stops (intentional — reconnecting requires re-auth to maintain the visual confirmation ritual).

### Local IP

Detected via `os.networkInterfaces()`: first non-loopback IPv4 address. Falls back to `127.0.0.1`.

### Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | no | PIN entry page (inline HTML) |
| POST | `/auth` | no | Validate PIN → cookie → redirect to `/app` |
| GET | `/app` | yes | App list page (inline HTML) |
| GET | `/api/state` | yes | `{ connectedCount: number }` JSON |
| * | any | — | 404 |

All HTML served inline as template strings — no static files. Mobile pages are minimal, responsive, dark-themed.

### IPC

| Channel | Direction | Payload |
|---------|-----------|---------|
| `mobile:start` | renderer → main | — |
| `mobile:stop` | renderer → main | — |
| `mobile:getState` | renderer → main | returns `MobileState` |
| `mobile:state` | main → renderer (push) | `MobileState` |

```ts
interface MobileState {
  running: boolean
  port: number
  localIp: string
  pin: string          // '32741' — shown in panel
  qrSvg: string        // SVG string for <img src="data:image/svg+xml;...">
  connectedCount: number
}
```

---

## MobileDisplayPanel UI

The existing placeholder header is preserved. New content:

1. **Toggle** — on/off switch at the top. Calls `mobile:start` / `mobile:stop` via IPC.
2. **QR code** — rendered from `qrSvg` as a data URI in an `<img>` tag. Shown only when running.
3. **PIN display** — each digit in its own box, `font-mono text-2xl`. Shown when running.
4. **Countdown ring** — 15s CSS animation ring, resets on each `mobile:state` push. Shows time until next PIN rotation.
5. **Connected badge** — `"1 device connected"` or hidden when 0.
6. **URL label** — `http://<localIp>:<port>` shown beneath the QR code for manual entry fallback.

When the server is stopped, the panel shows only the toggle and a short prompt ("Turn on to connect your phone").

---

## Mobile Web Pages

### GET `/` — PIN entry

- Minimal full-screen page, dark background.
- Title: "Connect to Huginn"
- Instruction: "Enter the 5-digit PIN shown in the Huginn app"
- `<input type="text" inputmode="numeric" maxlength="5">` + Submit button
- On submit: `POST /auth` with `pin=<value>`
- On auth failure: shake animation, "Incorrect PIN — try again"

### GET `/app` — App list

- Grid of app cards.
- One card: **Claude Usage** (placeholder, taps to `/app/claude-usage` — returns 501 for now)
- Simple, touch-friendly, 44px tap targets.

---

## Testing

- Unit tests for `MobileServer` PIN generation and rotation logic (no live server needed — extract pure functions).
- Unit test for `MobileDisplayPanel` toggle rendering and connected-state display.
- No integration test for the full HTTP flow (out of scope — manual test via phone).

---

## What this spec does NOT cover

- Claude Usage data pipeline (Sub-project 2)
- Charts/graphs on the mobile page (Sub-project 3)
- Persistent sessions across app restarts
- Multiple simultaneous Huginn windows
