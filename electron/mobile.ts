import { BrowserWindow, ipcMain } from 'electron'
import { createServer, IncomingMessage, ServerResponse, Server } from 'http'
import { networkInterfaces } from 'os'
import { randomUUID } from 'crypto'
import QRCode from 'qrcode'

export interface MobileState {
  running: boolean
  port: number
  localIp: string
  pin: string
  qrSvg: string
  connectedCount: number
}

function getLocalIp(): string {
  const nets = networkInterfaces()
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
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
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0d0d0d;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px}</style></head><body>${body}</body></html>`
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

function notImplementedPage(): string {
  return html('Coming Soon', `<div style="text-align:center"><h1 style="font-size:20px;font-weight:600;color:#888">Coming Soon</h1><p style="margin-top:8px;font-size:14px;color:#555">This feature is under construction.</p></div>`)
}

const BASE_PORT = 7842

export class MobileServer {
  private win: BrowserWindow
  private server: Server | null = null
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
          this.state.connectedCount = this.sessions.size
          this.pushState()
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
      res.writeHead(501, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(notImplementedPage())
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

    this.state = { running: true, port: this.port, localIp, pin: this.pin, qrSvg, connectedCount: 0 }
    this.pushState()
  }

  stop(): void {
    if (this.rotateInterval) { clearInterval(this.rotateInterval); this.rotateInterval = null }
    this.server?.close()
    this.server = null
    this.sessions.clear()
    this.state = { running: false, port: this.port, localIp: this.state.localIp, pin: '', qrSvg: '', connectedCount: 0 }
    this.pushState()
  }

  registerHandlers(): void {
    ipcMain.handle('mobile:start', async () => {
      try { await this.start() } catch (e) { console.error('MobileServer start failed:', e) }
    })
    ipcMain.handle('mobile:stop', () => this.stop())
    ipcMain.handle('mobile:getState', () => this.state)
  }

  dispose(): void {
    this.stop()
  }
}
