import { describe, it, expect, beforeEach, vi } from 'vitest'

const { handlers, winsById, fakeSession } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
  // The given implementation resolves a bare winId back to a BrowserWindow via
  // BrowserWindow.fromId (needed by disposeWindow/setZoom, which only receive a
  // numeric id, not the ipc event). Real Electron provides this statically;
  // here it's backed by whatever fromWebContents has already seen.
  winsById: new Map<number, any>(),
  fakeSession: { clearCache: vi.fn(() => Promise.resolve()) },
}))

function fakeWebContentsView() {
  return {
    setBackgroundColor: vi.fn(),
    webContents: {
      id: Math.floor(Math.random() * 100000),
      loadURL: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      getZoomLevel: vi.fn(() => 0),
      isDestroyed: vi.fn(() => false),
      close: vi.fn(),
      setUserAgent: vi.fn(),
      reload: vi.fn(),
      enableDeviceEmulation: vi.fn(),
      disableDeviceEmulation: vi.fn(),
    },
  }
}

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
  },
  BrowserWindow: {
    fromWebContents: (sender: any) => {
      winsById.set(sender.id, sender)
      return sender
    },
    fromId: (id: number) => winsById.get(id),
  },
  WebContentsView: vi.fn().mockImplementation(() => fakeWebContentsView()),
  session: { fromPartition: vi.fn(() => fakeSession) },
}))

import { BrowserViewManager } from '../browserViews'
import { WebContentsView } from 'electron'

function fakeWin(id: number) {
  return {
    id,
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
  }
}

describe('BrowserViewManager multi-window isolation', () => {
  it('creating a view with the same id in two windows produces two independent entries', () => {
    const manager = new BrowserViewManager()
    manager.registerHandlers()
    const winA = fakeWin(1)
    const winB = fakeWin(2)

    const idA = handlers['browserView:create']({ sender: winA }, 'tab-1', 'https://example.com')
    const idB = handlers['browserView:create']({ sender: winB }, 'tab-1', 'https://example.org')

    expect(winA.contentView.addChildView).toHaveBeenCalledTimes(1)
    expect(winB.contentView.addChildView).toHaveBeenCalledTimes(1)
    expect(idA).not.toBe(idB)
  })

  it('disposeWindow destroys only that window\'s views', () => {
    const manager = new BrowserViewManager()
    manager.registerHandlers()
    const winA = fakeWin(1)
    const winB = fakeWin(2)

    handlers['browserView:create']({ sender: winA }, 'tab-1', 'https://example.com')
    handlers['browserView:create']({ sender: winB }, 'tab-1', 'https://example.org')
    manager.disposeWindow(1)

    expect(winA.contentView.removeChildView).toHaveBeenCalledTimes(1)
    expect(winB.contentView.removeChildView).not.toHaveBeenCalled()
  })

  it('disposeWindow still closes webContents when the window is no longer resolvable via fromId (e.g. after its "closed" event has already fired)', () => {
    const manager = new BrowserViewManager()
    manager.registerHandlers()
    const winC = fakeWin(3)

    handlers['browserView:create']({ sender: winC }, 'tab-1', 'https://example.com')
    // Simulate BrowserWindow.fromId no longer being able to resolve the window
    // by the time disposal runs.
    winsById.delete(3)

    manager.disposeWindow(3)

    const created = (WebContentsView as unknown as ReturnType<typeof vi.fn>).mock.results
    const view = created[created.length - 1].value
    expect(view.webContents.close).toHaveBeenCalledWith({ waitForBeforeUnload: false })
    // win is unresolvable, so removeChildView (which needs the win object) can't be called
    expect(winC.contentView.removeChildView).not.toHaveBeenCalled()
  })
})

describe('BrowserViewManager mobile mode', () => {
  const device = { width: 390, height: 844, pixelRatio: 3 }

  it('enabling mobile mode sets a mobile user agent, emulates the device viewport, and reloads', () => {
    const manager = new BrowserViewManager()
    manager.registerHandlers()
    const win = fakeWin(10)

    handlers['browserView:create']({ sender: win }, 'tab-1', 'https://example.com')
    const created = (WebContentsView as unknown as ReturnType<typeof vi.fn>).mock.results
    const view = created[created.length - 1].value

    handlers['browserView:setMobileMode']({ sender: win }, 'tab-1', true, device)

    expect(view.webContents.setUserAgent).toHaveBeenCalledWith(expect.stringContaining('Mobile'))
    expect(view.webContents.enableDeviceEmulation).toHaveBeenCalledWith(
      expect.objectContaining({
        viewSize: { width: 390, height: 844 },
        deviceScaleFactor: 3,
      })
    )
    expect(view.webContents.reload).toHaveBeenCalledTimes(1)
  })

  it('disabling mobile mode resets the user agent, disables emulation, and reloads', () => {
    const manager = new BrowserViewManager()
    manager.registerHandlers()
    const win = fakeWin(11)

    handlers['browserView:create']({ sender: win }, 'tab-1', 'https://example.com')
    const created = (WebContentsView as unknown as ReturnType<typeof vi.fn>).mock.results
    const view = created[created.length - 1].value

    handlers['browserView:setMobileMode']({ sender: win }, 'tab-1', true, device)
    handlers['browserView:setMobileMode']({ sender: win }, 'tab-1', false)

    expect(view.webContents.setUserAgent).toHaveBeenLastCalledWith('')
    expect(view.webContents.disableDeviceEmulation).toHaveBeenCalledTimes(1)
    expect(view.webContents.reload).toHaveBeenCalledTimes(2)
  })
})

describe('BrowserViewManager clear cache', () => {
  it('clears the shared session cache and reloads the requesting tab', async () => {
    const manager = new BrowserViewManager()
    manager.registerHandlers()
    const win = fakeWin(12)

    handlers['browserView:create']({ sender: win }, 'tab-1', 'https://example.com')
    const created = (WebContentsView as unknown as ReturnType<typeof vi.fn>).mock.results
    const view = created[created.length - 1].value

    await handlers['browserView:clearCache']({ sender: win }, 'tab-1')

    expect(fakeSession.clearCache).toHaveBeenCalledTimes(1)
    expect(view.webContents.reload).toHaveBeenCalledTimes(1)
  })
})
