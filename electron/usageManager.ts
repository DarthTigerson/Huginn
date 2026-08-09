import { BrowserWindow, ipcMain } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { UsagePoller } from './usagePoller'

export type UsageSource = 'mobile' | 'desktop' | 'passive'

// Any of mobile pairing, the desktop usage panel, or the passive-monitoring
// setting can independently want the poller running — refcount them instead
// of tying the poller's lifecycle to any single feature's on/off state.
export class UsageManager {
  readonly poller: UsagePoller
  private active = new Set<UsageSource>()

  constructor(
    historyFile: string,
    pollSettingsFile: string,
    private readonly passiveSettingsFile: string,
    private readonly win: BrowserWindow
  ) {
    this.poller = new UsagePoller(historyFile, pollSettingsFile, () => {
      this.win.webContents.send('usage:update', this.poller.getLatest())
    })
    if (this.loadPassiveEnabled()) this.acquire('passive')
  }

  private loadPassiveEnabled(): boolean {
    try {
      return JSON.parse(readFileSync(this.passiveSettingsFile, 'utf-8')).enabled === true
    } catch {
      return false
    }
  }

  private savePassiveEnabled(enabled: boolean): void {
    try {
      writeFileSync(this.passiveSettingsFile, JSON.stringify({ enabled }))
    } catch (e) {
      console.error('UsageManager passive settings write failed:', e)
    }
  }

  getPassiveEnabled(): boolean {
    return this.active.has('passive')
  }

  setPassiveEnabled(enabled: boolean): void {
    this.savePassiveEnabled(enabled)
    if (enabled) this.acquire('passive')
    else this.release('passive')
  }

  acquire(source: UsageSource): void {
    const wasEmpty = this.active.size === 0
    this.active.add(source)
    if (wasEmpty) this.poller.start()
  }

  release(source: UsageSource): void {
    this.active.delete(source)
    if (this.active.size === 0) this.poller.stop()
  }

  registerHandlers(): void {
    ipcMain.handle('usage:acquire', () => this.acquire('desktop'))
    ipcMain.handle('usage:release', () => this.release('desktop'))
    ipcMain.handle('usage:getLatest', () => this.poller.getLatest())
    ipcMain.handle('usage:getPassiveEnabled', () => this.getPassiveEnabled())
    ipcMain.handle('usage:setPassiveEnabled', (_evt, enabled: boolean) => this.setPassiveEnabled(enabled))
  }
}
