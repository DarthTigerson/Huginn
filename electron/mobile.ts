import { BrowserWindow, ipcMain } from 'electron'
import { createServer, IncomingMessage, ServerResponse, Server } from 'http'
import { networkInterfaces } from 'os'
import { randomUUID } from 'crypto'
import QRCode from 'qrcode'
import { UsagePoller } from './usagePoller'

export interface MobileState {
  running: boolean
  port: number
  localIp: string
  pin: string
  qrSvg: string
  connectedCount: number
  allowingNewDevice: boolean
}

function getLocalIp(): string {
  const nets = networkInterfaces()
  const candidates: string[] = []
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family !== 'IPv4' || iface.internal) continue
      if (iface.address.startsWith('169.254.')) continue // skip link-local
      candidates.push(iface.address)
    }
  }
  // prefer 192.168.x.x, then 10.x.x.x, then 172.x.x.x, then whatever's left
  return (
    candidates.find((a) => a.startsWith('192.168.')) ??
    candidates.find((a) => a.startsWith('10.')) ??
    candidates.find((a) => a.startsWith('172.')) ??
    candidates[0] ??
    '127.0.0.1'
  )
}

export function generatePin(): string {
  return String(Math.floor(Math.random() * 100000)).padStart(5, '0')
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map((c) => c.trim().split('=').map((s) => s.trim()) as [string, string])
  )
}

function html(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="mobile-web-app-capable" content="yes"><meta name="theme-color" content="#0d0d0d"><title>${title}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0d0d0d;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom))}</style></head><body>${body}<script>
(async()=>{
  try{let w=await navigator.wakeLock.request('screen');document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible')w=await navigator.wakeLock.request('screen').catch(()=>{})});}catch(e){}
  var fs=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;
  if(fs)document.addEventListener('touchstart',function h(){fs.call(document.documentElement);document.removeEventListener('touchstart',h);},{once:true,passive:true});
})();
</script></body></html>`
}

function pinEntryPage(error?: string): string {
  const errHtml = error
    ? `<p style="color:#f87171;font-size:14px;margin-bottom:12px;text-align:center">${error}</p>`
    : ''
  return html(
    'Connect to Huginn',
    `<div style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:24px;align-items:center">
      <div style="text-align:center">
        <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.5px">Connect to Huginn</h1>
        <p style="margin-top:8px;font-size:14px;color:#888">Enter the 5-digit PIN shown in the Huginn app</p>
      </div>
      ${errHtml}
      <form method="POST" action="/auth" style="width:100%;display:flex;flex-direction:column;gap:12px">
        <input name="pin" type="text" inputmode="numeric" maxlength="5" autocomplete="one-time-code" placeholder="00000"
          style="width:100%;padding:14px;font-size:28px;letter-spacing:12px;text-align:center;background:#1a1a1a;border:1.5px solid #333;border-radius:12px;color:#f0f0f0;outline:none"/>
        <button type="submit"
          style="width:100%;padding:14px;font-size:16px;font-weight:600;background:#4f46e5;color:#fff;border:none;border-radius:12px;cursor:pointer">
          Connect
        </button>
      </form>
    </div>`
  )
}

function appListPage(): string {
  return html(
    'Huginn Mobile',
    `<div style="width:100%;max-width:400px">
      <h1 style="font-size:20px;font-weight:700;margin-bottom:20px;text-align:center;letter-spacing:-0.5px">Huginn</h1>
      <a href="/app/claude-usage"
        style="display:flex;align-items:center;gap:16px;padding:20px;background:#1a1a1a;border:1.5px solid #2a2a2a;border-radius:16px;text-decoration:none;color:#f0f0f0;transition:border-color 0.15s">
        <div style="width:48px;height:48px;background:#4f46e5;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px">📊</div>
        <div>
          <div style="font-size:16px;font-weight:600">Claude Usage</div>
          <div style="font-size:13px;color:#666;margin-top:2px">Token usage &amp; stats</div>
        </div>
      </a>
    </div>`
  )
}

const CIRC = (2 * Math.PI * 38).toFixed(2)

function svgGauge(id: string, label: string): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
    <svg viewBox="0 0 100 100" width="120" height="120">
      <circle cx="50" cy="50" r="38" fill="none" stroke="#1e1e1e" stroke-width="10"/>
      <circle id="${id}-arc" cx="50" cy="50" r="38" fill="none" stroke="#4f46e5" stroke-width="10"
        stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"
        stroke-linecap="round" transform="rotate(-90 50 50)"
        style="transition:stroke-dashoffset 0.6s ease"/>
      <text id="${id}-pct" x="50" y="47" text-anchor="middle"
        fill="#f0f0f0" font-size="21" font-weight="700" font-family="-apple-system,sans-serif">—</text>
      <text x="50" y="62" text-anchor="middle"
        fill="#555" font-size="9" letter-spacing="0.5" font-family="-apple-system,sans-serif">${label.toUpperCase()}</text>
    </svg>
  </div>`
}

function claudeUsagePage(): string {
  const js = `
var CIRC=${CIRC};
function setArc(id,pct){
  var a=document.getElementById(id+'-arc');
  var t=document.getElementById(id+'-pct');
  if(a)a.setAttribute('stroke-dashoffset',CIRC*(1-pct/100));
  if(t)t.textContent=pct+'%';
}
function pts(snaps,w,h){
  if(!snaps||snaps.length<2)return'';
  var mx=Math.max.apply(null,snaps.map(function(s){return s.sessionPct;}).concat([5]));
  return snaps.map(function(s,i){
    var x=(i/(snaps.length-1))*w;
    var y=h-4-(s.sessionPct/mx)*(h-10);
    return x.toFixed(1)+','+y.toFixed(1);
  }).join(' ');
}
function fillPts(snaps,w,h){
  var p=pts(snaps,w,h);
  if(!p)return'';
  return p+' '+w+','+h+' 0,'+h;
}
function render(data){
  var l=data.latest;
  if(!l)return;
  setArc('session',l.sessionPct);
  setArc('weekly',l.weeklyPct);
  document.getElementById('r24').textContent=l.requests24h;
  document.getElementById('r7d').textContent=l.requests7d;
  var snaps=data.snapshots||[];
  var p=pts(snaps,280,60);
  if(p){
    document.getElementById('uline').setAttribute('points',p);
    document.getElementById('ufill').setAttribute('points',fillPts(snaps,280,60));
  }
  var sk=l.topSkills||[];
  document.getElementById('skills').innerHTML=sk.length
    ?sk.map(function(s){
      var bar=Math.round(s.pct*1.8);
      return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #1a1a1a">'
        +'<span style="font-size:12px;color:#888;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+s.name+'</span>'
        +'<div style="width:'+bar+'px;height:3px;background:#4f46e5;border-radius:2px;flex-shrink:0"></div>'
        +'<span style="font-size:12px;font-weight:700;color:#4f46e5;width:32px;text-align:right">'+s.pct+'%</span>'
        +'</div>';
    }).join('')
    :'<p style="font-size:12px;color:#333">No data yet</p>';
  var now=new Date();
  document.getElementById('upd').textContent=now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
}
function refresh(){fetch('/api/usage').then(function(r){return r.json();}).then(render).catch(function(){});}
refresh();
setInterval(refresh,60000);
`

  const body = `<div style="width:100%;max-width:380px;display:flex;flex-direction:column;gap:20px;padding-bottom:32px">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <a href="/app" style="color:#555;text-decoration:none;font-size:14px">← Back</a>
    <h1 style="font-size:17px;font-weight:700">Claude Usage</h1>
    <span id="upd" style="font-size:11px;color:#444">—</span>
  </div>

  <div style="display:flex;justify-content:center;gap:20px">
    ${svgGauge('session', 'Session')}
    ${svgGauge('weekly', 'This Week')}
  </div>

  <div style="background:#111;border-radius:14px;padding:16px 16px 10px">
    <p style="font-size:10px;color:#444;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.8px">Session usage over time</p>
    <svg viewBox="0 0 280 60" width="100%" style="display:block;overflow:visible">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#4f46e5" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="0" y1="58" x2="280" y2="58" stroke="#1e1e1e" stroke-width="1"/>
      <polygon id="ufill" points="0,60 0,60" fill="url(#grad)"/>
      <polyline id="uline" points="0,30" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <p style="font-size:10px;color:#2a2a2a;margin-top:4px;text-align:right">last 60 polls</p>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div style="background:#111;border-radius:14px;padding:18px 16px;text-align:center">
      <div id="r24" style="font-size:32px;font-weight:800;color:#f0f0f0;letter-spacing:-1px">—</div>
      <div style="font-size:10px;color:#444;margin-top:5px;text-transform:uppercase;letter-spacing:0.5px">Today</div>
    </div>
    <div style="background:#111;border-radius:14px;padding:18px 16px;text-align:center">
      <div id="r7d" style="font-size:32px;font-weight:800;color:#f0f0f0;letter-spacing:-1px">—</div>
      <div style="font-size:10px;color:#444;margin-top:5px;text-transform:uppercase;letter-spacing:0.5px">This week</div>
    </div>
  </div>

  <div style="background:#111;border-radius:14px;padding:16px">
    <p style="font-size:10px;color:#444;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.8px">Top skills · 24h</p>
    <div id="skills"><p style="font-size:12px;color:#333">Loading…</p></div>
  </div>
</div><script>${js}</script>`

  return html('Claude Usage', body)
}

const BASE_PORT = 7842

export class MobileServer {
  private win: BrowserWindow
  private server: Server | null = null
  private poller = new UsagePoller()
  private port = BASE_PORT
  private pin = ''
  private prevPin = ''
  private sessions = new Set<string>()
  private rotateInterval: ReturnType<typeof setInterval> | null = null
  private state: MobileState = {
    running: false,
    port: BASE_PORT,
    localIp: '127.0.0.1',
    pin: '',
    qrSvg: '',
    connectedCount: 0,
    allowingNewDevice: true,
  }

  constructor(win: BrowserWindow) {
    this.win = win
  }

  private pushState(): void {
    this.win.webContents.send('mobile:state', this.state)
  }

  private rotatePin(): void {
    this.prevPin = this.pin
    this.pin = generatePin()
    this.state.pin = this.pin
    this.pushState()
  }

  private isValidPin(candidate: string): boolean {
    return candidate === this.pin || candidate === this.prevPin
  }

  private isAuthenticated(req: IncomingMessage): boolean {
    const cookies = parseCookies(req.headers.cookie)
    return this.sessions.has(cookies['session'] ?? '')
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://localhost:${this.port}`)
    const path = url.pathname

    if (req.method === 'GET' && path === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(pinEntryPage())
      return
    }

    if (req.method === 'POST' && path === '/auth') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        const params = new URLSearchParams(body)
        const candidate = params.get('pin') ?? ''
        if (this.isValidPin(candidate)) {
          const token = randomUUID()
          this.sessions.add(token)
          // stop rotation — pairing is done until user explicitly requests another device
          if (this.rotateInterval) { clearInterval(this.rotateInterval); this.rotateInterval = null }
          this.state.connectedCount = this.sessions.size
          this.state.allowingNewDevice = false
          this.state.pin = ''
          setImmediate(() => this.pushState())
          res.writeHead(302, {
            'Set-Cookie': `session=${token}; HttpOnly; SameSite=Strict; Path=/`,
            Location: '/app',
          })
          res.end()
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(pinEntryPage('Incorrect PIN — try again'))
        }
      })
      return
    }

    if (!this.isAuthenticated(req)) {
      res.writeHead(302, { Location: '/' })
      res.end()
      return
    }

    if (req.method === 'GET' && path === '/app') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(appListPage())
      return
    }

    if (req.method === 'GET' && path === '/app/claude-usage') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(claudeUsagePage())
      return
    }

    if (req.method === 'GET' && path === '/api/usage') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ snapshots: this.poller.getSnapshots(), latest: this.poller.getLatest() }))
      return
    }

    if (req.method === 'GET' && path === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ connectedCount: this.sessions.size }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }

  private async tryBind(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const s = createServer()
      s.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') reject(err)
        else reject(err)
      })
      s.once('listening', () => {
        s.close(() => resolve(port))
      })
      s.listen(port, '0.0.0.0')
    })
  }

  async start(): Promise<void> {
    if (this.server) return

    // find an available port
    for (let p = BASE_PORT; p < BASE_PORT + 5; p++) {
      try {
        await this.tryBind(p)
        this.port = p
        break
      } catch {
        if (p === BASE_PORT + 4) throw new Error('No available port found near 7842')
      }
    }

    this.pin = generatePin()
    this.prevPin = ''
    const localIp = getLocalIp()
    const url = `http://${localIp}:${this.port}`
    const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1 })

    this.server = createServer((req, res) => this.handleRequest(req, res))
    await new Promise<void>((resolve) => {
      this.server!.listen(this.port, '0.0.0.0', resolve)
    })

    this.rotateInterval = setInterval(() => this.rotatePin(), 15_000)
    this.poller.start()

    this.state = { running: true, port: this.port, localIp, pin: this.pin, qrSvg, connectedCount: 0, allowingNewDevice: true }
    this.pushState()
  }

  stop(): void {
    if (this.rotateInterval) { clearInterval(this.rotateInterval); this.rotateInterval = null }
    this.poller.stop()
    this.server?.close()
    this.server = null
    this.sessions.clear()
    this.state = { running: false, port: this.port, localIp: this.state.localIp, pin: '', qrSvg: '', connectedCount: 0, allowingNewDevice: true }
    this.pushState()
  }

  async addDevice(): Promise<void> {
    if (!this.server) return
    this.prevPin = ''
    this.pin = generatePin()
    this.state.pin = this.pin
    this.state.allowingNewDevice = true
    if (this.rotateInterval) clearInterval(this.rotateInterval)
    this.rotateInterval = setInterval(() => this.rotatePin(), 15_000)
    this.pushState()
  }

  registerHandlers(): void {
    ipcMain.handle('mobile:start', async () => {
      try { await this.start() } catch (e) { console.error('MobileServer start failed:', e) }
    })
    ipcMain.handle('mobile:stop', () => this.stop())
    ipcMain.handle('mobile:getState', () => this.state)
    ipcMain.handle('mobile:addDevice', () => this.addDevice())
  }

  dispose(): void {
    this.stop()
  }
}
