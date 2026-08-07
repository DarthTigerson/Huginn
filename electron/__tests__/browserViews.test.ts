import { describe, it, expect, beforeEach, vi } from 'vitest'

const { handlers, winsById } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
  // The given implementation resolves a bare winId back to a BrowserWindow via
  // BrowserWindow.fromId (needed by disposeWindow/setZoom, which only receive a
  // numeric id, not the ipc event). Real Electron provides this statically;
  // here it's backed by whatever fromWebContents has already seen.
  winsById: new Map<number, any>(),
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
      close: vi.fn(),
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
  session: { fromPartition: vi.fn(() => ({})) },
}))

import { BrowserViewManager } from '../browserViews'

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
})
