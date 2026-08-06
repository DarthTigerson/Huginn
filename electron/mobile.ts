import { app, BrowserWindow, ipcMain } from 'electron'
import { createServer, IncomingMessage, ServerResponse, Server } from 'http'
import { networkInterfaces } from 'os'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
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

const MOBILE_WEB_DIR = join(app.getAppPath(), 'electron', 'mobileWeb')

const ASSET_TYPES: Record<string, string> = {
  'style.css': 'text/css; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'usage.js': 'text/javascript; charset=utf-8',
}

function readPage(name: string): string {
  return readFileSync(join(MOBILE_WEB_DIR, name), 'utf-8')
}

function renderPage(name: string, vars: { theme: string; pinError?: string }): string {
  let out = readPage(name).replace(/%%THEME%%/g, vars.theme)
  if (out.includes('%%PIN_ERROR%%')) {
    const errHtml = vars.pinError
      ? `<p style="color:#f87171;font-size:14px;text-align:center">${vars.pinError}</p>`
      : ''
    out = out.replace('%%PIN_ERROR%%', errHtml)
  }
  return out
}

const USAGE_RANGE_MS: Record<string, number> = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
}

const BASE_PORT = 7842

export class MobileServer {
  private win: BrowserWindow
  private server: Server | null = null
  private poller = new UsagePoller(
    join(app.getPath('userData'), 'usage-history.jsonl'),
    join(app.getPath('userData'), 'usage-settings.json')
  )
  private port = BASE_PORT
  private pin = ''
  private prevPin = ''
  private sessions = new Set<string>()
  private rotateInterval: ReturnType<typeof setInterval> | null = null
  private currentTheme = 'claude-dark'
  private currentFont = 'Menlo, monospace'
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

  setDisplay(theme: string, font: string): void {
    this.currentTheme = theme
    this.currentFont = font
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://localhost:${this.port}`)
    const path = url.pathname

    // Served unauthenticated — the pin-entry page itself needs these before a session exists.
    if (req.method === 'GET' && path.startsWith('/mobile-assets/')) {
      const name = path.slice('/mobile-assets/'.length)
      const contentType = ASSET_TYPES[name]
      if (!contentType) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
        return
      }
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(readPage(name))
      return
    }

    if (req.method === 'GET' && path === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(renderPage('pin.html', { theme: this.currentTheme }))
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
          res.end(renderPage('pin.html', { theme: this.currentTheme, pinError: 'Incorrect PIN — try again' }))
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
      res.end(renderPage('home.html', { theme: this.currentTheme }))
      return
    }

    if (req.method === 'GET' && path === '/app/claude-usage') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(renderPage('usage.html', { theme: this.currentTheme }))
      return
    }

    if (req.method === 'GET' && path === '/api/usage') {
      const range = url.searchParams.get('range') ?? '24h'
      const rangeMs = USAGE_RANGE_MS[range] ?? USAGE_RANGE_MS['24h']
      const snapshots = this.poller.getRange(Date.now() - rangeMs, Date.now())
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ snapshots, latest: this.poller.getLatest() }))
      return
    }

    if (req.method === 'POST' && path === '/api/usage/interval') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        let ms: number | undefined
        try { ms = JSON.parse(body).ms } catch { /* invalid body — ms stays undefined */ }
        const ok = typeof ms === 'number' && this.poller.setIntervalMs(ms)
        res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok, intervalMs: this.poller.getIntervalMs() }))
      })
      return
    }

    if (req.method === 'GET' && path === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        connectedCount: this.sessions.size,
        theme: this.currentTheme,
        font: this.currentFont,
        pollIntervalMs: this.poller.getIntervalMs(),
      }))
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
    ipcMain.on('mobile:setDisplay', (_evt, theme: string, font: string) => this.setDisplay(theme, font))
  }

  dispose(): void {
    this.stop()
  }
}
