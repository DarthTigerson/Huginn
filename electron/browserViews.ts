import { BrowserWindow, WebContentsView, ipcMain, session } from 'electron'

// Guest pages share this dedicated partition with each other (so cookies/logins
// persist across browser tabs like normal browser tabs would) but NOT with the
// main window's own session. Without this, WebContentsView shares Electron's
// default session with the main window, and Chromium's zoom level is scoped to
// the session rather than the individual webContents — so zooming a guest page
// silently zoomed the entire app UI (sidebar, tabs, everything) in lockstep.
// Created lazily (not at module load) because session.fromPartition requires
// the app to be ready.
function getBrowserSession(): Electron.Session {
  return session.fromPartition('persist:browser-tabs')
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export type BrowserViewEvent =
  | { type: 'did-start-loading' }
  | { type: 'did-stop-loading'; canGoBack: boolean; canGoForward: boolean }
  | { type: 'did-navigate'; url: string; canGoBack: boolean; canGoForward: boolean }
  | { type: 'did-navigate-in-page'; url: string; canGoBack: boolean; canGoForward: boolean }
  | { type: 'page-title-updated'; title: string }
  | { type: 'did-fail-load'; errorDescription: string }
  | { type: 'dom-ready'; webContentsId: number }
  | { type: 'zoom-changed'; level: number }

interface Entry {
  view: WebContentsView
  attached: boolean
}

// <webview> was dropped in favor of WebContentsView because Electron's <webview>
// guest never syncs its own window.innerHeight/vh-based layout past the intrinsic
// 300x150 default — confirmed via isolated repro, not fixable from the outside.
// WebContentsView reports its real bounds to the guest correctly, at the cost of
// needing its pixel bounds pushed from the renderer on every resize/pane-move
// instead of it just living in the DOM flex layout.
export class BrowserViewManager {
  private views = new Map<string, Entry>()

  constructor(private win: BrowserWindow) {}

  registerHandlers(): void {
    ipcMain.handle('browserView:create', (_e, id: string, url: string) => this.create(id, url))
    ipcMain.handle('browserView:setBounds', (_e, id: string, bounds: Bounds) => this.setBounds(id, bounds))
    ipcMain.handle('browserView:setVisible', (_e, id: string, visible: boolean) => this.setVisible(id, visible))
    ipcMain.handle('browserView:navigate', (_e, id: string, url: string) => this.get(id)?.webContents.loadURL(url))
    ipcMain.handle('browserView:goBack', (_e, id: string) => this.get(id)?.webContents.navigationHistory.goBack())
    ipcMain.handle('browserView:goForward', (_e, id: string) => this.get(id)?.webContents.navigationHistory.goForward())
    ipcMain.handle('browserView:reload', (_e, id: string) => this.get(id)?.webContents.reload())
    ipcMain.handle('browserView:zoomIn', (_e, id: string) =>
      this.setZoom(id, (this.get(id)?.webContents.getZoomLevel() ?? 0) + 1)
    )
    ipcMain.handle('browserView:zoomOut', (_e, id: string) =>
      this.setZoom(id, (this.get(id)?.webContents.getZoomLevel() ?? 0) - 1)
    )
    ipcMain.handle('browserView:zoomReset', (_e, id: string) => this.setZoom(id, 0))
    ipcMain.handle('browserView:destroy', (_e, id: string) => this.destroy(id))
  }

  private get(id: string): WebContentsView | undefined {
    return this.views.get(id)?.view
  }

  private create(id: string, url: string): number | null {
    const existing = this.views.get(id)
    if (existing) return existing.view.webContents.id

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        session: getBrowserSession(),
      },
    })
    view.setBackgroundColor('#1e1e1e')
    view.webContents.loadURL(url)
    this.wireEvents(id, view)

    this.win.contentView.addChildView(view)
    this.views.set(id, { view, attached: true })
    return view.webContents.id
  }

  private sendEvent(id: string, payload: BrowserViewEvent): void {
    if (!this.win.isDestroyed()) this.win.webContents.send('browserView:event', id, payload)
  }

  private wireEvents(id: string, view: WebContentsView): void {
    const wc = view.webContents

    wc.on('did-start-loading', () => this.sendEvent(id, { type: 'did-start-loading' }))
    wc.on('did-stop-loading', () =>
      this.sendEvent(id, {
        type: 'did-stop-loading',
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      })
    )
    wc.on('did-navigate', (_e, url) =>
      this.sendEvent(id, {
        type: 'did-navigate',
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      })
    )
    wc.on('did-navigate-in-page', (_e, url) =>
      this.sendEvent(id, {
        type: 'did-navigate-in-page',
        url,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      })
    )
    wc.on('page-title-updated', (_e, title) => this.sendEvent(id, { type: 'page-title-updated', title }))
    wc.on('did-fail-load', (_e, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
      // -3 is ERR_ABORTED, fired on normal navigation interruption (e.g. redirects) — not a real failure
      if (!isMainFrame || errorCode === -3) return
      this.sendEvent(id, { type: 'did-fail-load', errorDescription })
    })
    wc.on('dom-ready', () => {
      this.sendEvent(id, { type: 'dom-ready', webContentsId: wc.id })
      this.sendEvent(id, { type: 'zoom-changed', level: wc.getZoomLevel() })
      // Trackpad pinch and Ctrl+scroll are delivered to the guest page as a
      // ctrlKey wheel event. Real browsers preventDefault() it to drive their own
      // page zoom, which also happens to be what stops macOS's system-wide
      // Accessibility Zoom from treating the same gesture as a request to
      // magnify the whole screen. The arbitrary content loaded here won't do
      // that itself, so do it on its behalf.
      wc.executeJavaScript(
        `window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault() }, { passive: false, capture: true })`
      ).catch(() => {})
    })

    // Unshifted CmdOrCtrl+=/-/0 zoom just this guest — same "unshifted = scoped to
    // the focused thing" split the editor/terminal use, extended to embedded pages.
    // Shares setZoom() with the browserView:zoomIn/zoomOut/zoomReset IPC handlers
    // (used by the browser tab's own "..." menu) so both paths apply the exact
    // same clamp and always agree on the current level.
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.shift || input.alt) return
      if (!input.meta && !input.control) return

      if (input.key === '=' || input.key === '+') {
        event.preventDefault()
        this.setZoom(id, wc.getZoomLevel() + 1)
      } else if (input.key === '-' || input.key === '_') {
        event.preventDefault()
        this.setZoom(id, wc.getZoomLevel() - 1)
      } else if (input.key === '0') {
        event.preventDefault()
        this.setZoom(id, 0)
      }
    })
  }

  private setZoom(id: string, level: number): void {
    const wc = this.get(id)?.webContents
    if (!wc) return
    const clamped = Math.max(-8, Math.min(9, level))
    wc.setZoomLevel(clamped)
    this.sendEvent(id, { type: 'zoom-changed', level: clamped })
  }

  private setBounds(id: string, bounds: Bounds): void {
    this.get(id)?.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    })
  }

  private setVisible(id: string, visible: boolean): void {
    const entry = this.views.get(id)
    if (!entry) return
    if (visible && !entry.attached) {
      this.win.contentView.addChildView(entry.view)
      entry.attached = true
    } else if (!visible && entry.attached) {
      this.win.contentView.removeChildView(entry.view)
      entry.attached = false
    }
  }

  private destroy(id: string): void {
    const entry = this.views.get(id)
    if (!entry) return
    if (entry.attached) this.win.contentView.removeChildView(entry.view)
    entry.view.webContents.close({ waitForBeforeUnload: false })
    this.views.delete(id)
  }
}
