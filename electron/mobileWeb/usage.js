const CIRC = 238.76
const RANGES = ['1h', '24h', '7d', '30d']
const RANGE_MS = { '1h': 3_600_000, '24h': 86_400_000, '7d': 604_800_000, '30d': 2_592_000_000 }
const INTERVALS = [15000, 30000, 60000, 300000, 900000]

let currentRange = '24h'
let refreshTimer = null
let latestData = null
let currentSnapshots = []
// The window the chart actually spans — always the *full* requested range
// (e.g. a whole hour for "1H"), not just however far the data happens to
// reach, so a handful of points near "now" don't get stretched to fill the
// entire width regardless of which range is selected.
let currentWindow = { from: Date.now() - RANGE_MS['24h'], to: Date.now() }

function setArc(id, pct) {
  const arc = document.getElementById(id + '-arc')
  const text = document.getElementById(id + '-pct')
  if (arc) arc.setAttribute('stroke-dashoffset', String(CIRC * (1 - pct / 100)))
  if (text) text.textContent = pct + '%'
}

// The SVG viewBox is a plain 0-100 x 0-100 box (preserveAspectRatio="none",
// stretched to fill whatever box .chart-plot ends up — see style.css) so x
// is "percent of the way through the selected time window" (by actual
// timestamp, not by array index) and y is "100 minus percent used", both
// directly in the same units as the gridlines.
function xFor(ts) {
  const { from, to } = currentWindow
  return ((ts - from) / (to - from)) * 100
}
function yFor(pct) { return 100 - pct }

function pts(snaps) {
  if (!snaps || snaps.length < 2) return ''
  return snaps.map((s) => xFor(s.ts).toFixed(2) + ',' + yFor(s.sessionPct).toFixed(2)).join(' ')
}

function fillPts(snaps) {
  const p = pts(snaps)
  if (!p) return ''
  const firstX = xFor(snaps[0].ts).toFixed(2)
  const lastX = xFor(snaps[snaps.length - 1].ts).toFixed(2)
  return p + ' ' + lastX + ',100 ' + firstX + ',100'
}

function fmtTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Short form for chart axis labels / tooltip — full date+time for longer
// ranges (a bare "14:32" is meaningless once the chart spans days), just
// the time for a range that's all "today".
function fmtAxisTime(ts, range) {
  const d = new Date(ts)
  if (range === '1h' || range === '24h') {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function renderXAxis() {
  const axis = document.getElementById('chart-x-axis')
  axis.innerHTML = ''
  const { from, to } = currentWindow
  const COUNT = 4
  for (let i = 0; i < COUNT; i++) {
    const pct = (i / (COUNT - 1)) * 100
    const ts = from + (pct / 100) * (to - from)
    const span = document.createElement('span')
    span.style.left = pct + '%'
    span.textContent = fmtAxisTime(ts, currentRange)
    axis.appendChild(span)
  }
}

function fmtNum(n) {
  return n.toLocaleString()
}

function fmtCountdown(ts) {
  if (!ts) return '—'
  const diff = ts - Date.now()
  if (diff <= 0) return 'now'
  const totalMin = Math.floor(diff / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm'
}

function fmtRate(r) {
  return r == null ? '—' : '≈' + r.toFixed(2) + '%/hr'
}

function renderCountdowns() {
  if (!latestData) return
  document.getElementById('session-reset-countdown').textContent = fmtCountdown(latestData.sessionResetAt)
  document.getElementById('weekly-reset-countdown').textContent = fmtCountdown(latestData.weeklyResetAt)
}

function render(data) {
  const l = data.latest
  if (!l) return
  latestData = l

  setArc('session', l.sessionPct)
  setArc('weekly', l.weeklyPct)
  document.getElementById('r24').textContent = fmtNum(l.requests24h)
  document.getElementById('r7d').textContent = fmtNum(l.requests7d)

  document.getElementById('session-reset-time').textContent = fmtTime(l.sessionResetAt)
  document.getElementById('weekly-reset-time').textContent = fmtTime(l.weeklyResetAt)
  document.getElementById('session-rate').textContent = fmtRate(l.sessionAvgRatePerHour)
  document.getElementById('weekly-rate').textContent = fmtRate(l.weeklyAvgRatePerHour)
  renderCountdowns()

  const snaps = data.snapshots || []
  currentSnapshots = snaps
  const p = pts(snaps)
  document.getElementById('uline').setAttribute('points', p || '0,100')
  document.getElementById('ufill').setAttribute('points', p ? fillPts(snaps) : '0,100 0,100')
  renderXAxis()

  const sk = l.topSkills || []
  document.getElementById('skills').innerHTML = sk.length
    ? sk.map((s) => {
        const bar = Math.round(s.pct * 1.8)
        return '<div class="skill-row">'
          + '<span class="muted" style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + s.name + '</span>'
          + '<div style="width:' + bar + 'px;height:3px;background:var(--accent);border-radius:2px;flex-shrink:0"></div>'
          + '<span style="font-size:12px;font-weight:700;color:var(--accent);width:32px;text-align:right">' + s.pct + '%</span>'
          + '</div>'
      }).join('')
    : '<p class="subtle" style="font-size:12px">No data yet</p>'

  const now = new Date()
  document.getElementById('upd').textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0')
}

function fetchUsage() {
  const to = Date.now()
  currentWindow = { from: to - RANGE_MS[currentRange], to }
  fetch('/api/usage?range=' + currentRange).then((r) => r.json()).then(render).catch(() => {})
}

function scheduleRefresh(intervalMs) {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(fetchUsage, intervalMs)
}

function initRangeButtons() {
  const group = document.getElementById('range-buttons')
  RANGES.forEach((range) => {
    const btn = document.createElement('button')
    btn.textContent = range.toUpperCase()
    btn.className = 'pill' + (range === currentRange ? ' active' : '')
    btn.addEventListener('click', () => {
      currentRange = range
      group.querySelectorAll('.pill').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      fetchUsage()
    })
    group.appendChild(btn)
  })
}

function labelForInterval(ms) {
  return ms < 60000 ? (ms / 1000) + 's' : (ms / 60000) + 'm'
}

function initIntervalDropdown(currentMs) {
  const trigger = document.getElementById('interval-trigger')
  const label = document.getElementById('interval-trigger-label')
  const menu = document.getElementById('interval-menu')

  function setLabel(ms) { label.textContent = labelForInterval(ms) }
  function closeMenu() { menu.hidden = true }

  setLabel(currentMs)

  INTERVALS.forEach((ms) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'dropdown-item' + (ms === currentMs ? ' active' : '')
    item.textContent = labelForInterval(ms)
    item.addEventListener('click', () => {
      fetch('/api/usage/interval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ms }),
      }).then((r) => r.json()).then((res) => {
        if (!res.ok) return
        menu.querySelectorAll('.dropdown-item').forEach((el) => el.classList.remove('active'))
        item.classList.add('active')
        setLabel(res.intervalMs)
        scheduleRefresh(res.intervalMs)
        closeMenu()
      })
    })
    menu.appendChild(item)
  })

  trigger.addEventListener('click', (e) => {
    e.stopPropagation()
    menu.hidden = !menu.hidden
  })
  document.addEventListener('click', (e) => {
    if (!menu.hidden && e.target !== trigger && !menu.contains(e.target)) closeMenu()
  })
}

function initCrosshair() {
  const plot = document.getElementById('chart-plot')
  const crosshair = document.getElementById('crosshair')
  const dot = document.getElementById('chart-dot')
  const tooltip = document.getElementById('chart-tooltip')

  function nearestByTime(ts) {
    let best = 0
    let bestDiff = Infinity
    for (let i = 0; i < currentSnapshots.length; i++) {
      const diff = Math.abs(currentSnapshots[i].ts - ts)
      if (diff < bestDiff) { bestDiff = diff; best = i }
    }
    return currentSnapshots[best]
  }

  function show(clientX) {
    if (currentSnapshots.length < 2) return
    const rect = plot.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const ts = currentWindow.from + pct * (currentWindow.to - currentWindow.from)

    // Outside the actual data span (e.g. hovering the empty portion of a
    // range that's mostly "no data yet") — nothing meaningful to show.
    const first = currentSnapshots[0].ts
    const last = currentSnapshots[currentSnapshots.length - 1].ts
    if (ts < first || ts > last) { hide(); return }

    const snap = nearestByTime(ts)
    const x = xFor(snap.ts)
    const y = yFor(snap.sessionPct)

    crosshair.setAttribute('x1', x)
    crosshair.setAttribute('x2', x)
    crosshair.classList.add('visible')

    dot.style.left = x + '%'
    dot.style.top = y + '%'
    dot.hidden = false

    document.getElementById('tooltip-time').textContent = fmtAxisTime(snap.ts, currentRange)
    document.getElementById('tooltip-pct').textContent = snap.sessionPct + '% session'
    tooltip.hidden = false
    tooltip.style.left = x + '%'
    tooltip.style.transform = x < 20 ? 'translateX(0)' : x > 80 ? 'translateX(-100%)' : 'translateX(-50%)'
  }

  function hide() {
    crosshair.classList.remove('visible')
    dot.hidden = true
    tooltip.hidden = true
  }

  plot.addEventListener('pointerdown', (e) => show(e.clientX))
  plot.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType !== 'touch') show(e.clientX) })
  plot.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') hide() })
  plot.addEventListener('pointerleave', hide)
}

fetch('/api/state').then((r) => r.json()).then((s) => {
  initIntervalDropdown(s.pollIntervalMs)
  scheduleRefresh(s.pollIntervalMs)
})
initRangeButtons()
initCrosshair()
fetchUsage()
setInterval(renderCountdowns, 1000)
