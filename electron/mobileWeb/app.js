// Shared across all mobile pages: keeps the theme/font in sync with the IDE,
// keeps the screen awake, and requests fullscreen on first touch.

function applyDisplay(theme, font) {
  if (theme) document.documentElement.dataset.theme = theme
  if (font) document.documentElement.style.setProperty('--font-mono', font)
}

function pollDisplay() {
  fetch('/api/state')
    .then((r) => r.json())
    .then((s) => applyDisplay(s.theme, s.font))
    .catch(() => {})
}

// Wake Lock requires a secure context. The phone loads this page over plain
// http://<lan-ip>, which iOS Safari treats as insecure, so
// navigator.wakeLock silently fails there — this is why the screen used to
// keep sleeping. The canvas -> captureStream() -> hidden <video> trick keeps
// iOS awake without needing a secure context or any embedded media file.
function initNoSleep() {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    const stream = canvas.captureStream(1)
    const video = document.createElement('video')
    video.muted = true
    video.setAttribute('muted', '')
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
    video.srcObject = stream
    document.body.appendChild(video)
    setInterval(() => { ctx.fillRect(0, 0, 1, 1) }, 1000)
    const play = () => video.play().catch(() => {})
    play()
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') play() })
  } catch (e) { /* captureStream unsupported — nothing more we can do */ }

  if ('wakeLock' in navigator) {
    const request = () => navigator.wakeLock.request('screen').catch(() => {})
    request()
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') request() })
  }
}

function initFullscreenOnTap() {
  const fs = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen
  if (!fs) return
  document.addEventListener('touchstart', function h() {
    fs.call(document.documentElement)
    document.removeEventListener('touchstart', h)
  }, { once: true, passive: true })
}

pollDisplay()
setInterval(pollDisplay, 10000)
initNoSleep()
initFullscreenOnTap()
