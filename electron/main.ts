import { app, BrowserWindow, ipcMain, dialog, Menu, shell, webContents } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { access, mkdir, readFile, rename, writeFile } from 'fs/promises'
import { PtyManager } from './pty'
import { ClaudeManager } from './claude'
import { GitRunner } from './gitRunner'
import { GitWatcher } from './gitWatcher'
import { MobileServer } from './mobile'
import { CosmosManager } from './cosmos'
import { BrowserViewManager } from './browserViews'
import { listAllFiles, searchText, buildTree } from './fsOps'
import { registerSessionHandlers } from './session'

function registerFsHandlers(): void {
  ipcMain.handle('fs:readDir', (_e, path: string) => buildTree(path))
  ipcMain.handle('fs:readFile', (_e, path: string) => readFile(path, 'utf-8'))
  ipcMain.handle('fs:exists', async (_e, path: string) => {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  })
  ipcMain.handle('fs:writeFile', (_e, path: string, content: string) =>
    writeFile(path, content, 'utf-8')
  )
  ipcMain.handle('fs:mkdir', (_e, path: string) => mkdir(path, { recursive: false }))
  ipcMain.handle('fs:rename', (_e, from: string, to: string) => rename(from, to))
  ipcMain.handle('fs:trash', (_e, path: string) => shell.trashItem(path))
  ipcMain.handle('fs:listAllFiles', (_e, root: string) => listAllFiles(root))
  ipcMain.handle('fs:searchText', (_e, root: string, query: string, caseSensitive: boolean) =>
    searchText(root, query, caseSensitive)
  )
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
}

function registerDevtoolsHandlers(): void {
  ipcMain.handle('devtools:attach', (_e, targetId: number, hostId: number) => {
    const target = webContents.fromId(targetId)
    const host = webContents.fromId(hostId)
    if (!target || !host) return
    target.setDevToolsWebContents(host)
    target.openDevTools()
  })

  ipcMain.handle('devtools:detach', (_e, targetId: number) => {
    webContents.fromId(targetId)?.closeDevTools()
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  // Chromium persists page zoom per-origin across restarts. If it ever gets
  // stuck at some large factor (e.g. a stray native zoom accelerator firing
  // repeatedly), that would otherwise survive indefinitely — force it back to
  // 100% on every load so the window can never get stuck zoomed.
  win.webContents.on('dom-ready', () => {
    win.webContents.setZoomFactor(1)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.name = 'Huginn'

function registerCosmosSettingsHandlers(): void {
  const settingsPath = join(app.getPath('userData'), 'cosmos-settings.json')

  ipcMain.handle('cosmos:getSettings', async () => {
    try {
      const data = await readFile(settingsPath, 'utf-8')
      return JSON.parse(data)
    } catch {
      return null
    }
  })

  ipcMain.handle('cosmos:setSettings', async (_e, settings: { endpoint: string; apiKey: string; modelId: string }) => {
    try {
      await writeFile(settingsPath, JSON.stringify(settings), 'utf-8')
    } catch {}
  })
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Huginn',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open New Project…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:openProject')
          },
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:closeActiveTab')
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          // Unshifted CmdOrCtrl+Plus/Minus/0 are intentionally NOT registered here —
          // they're left free so the renderer can handle them per-focused-editor/terminal.
          // Shifted variants control the global app font size instead.
          label: 'Reset Zoom (Global)',
          accelerator: 'CmdOrCtrl+Shift+0',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:resetZoom')
          },
        },
        {
          label: 'Zoom In (Global)',
          accelerator: 'CmdOrCtrl+Shift+=',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:zoomIn')
          },
        },
        {
          label: 'Zoom Out (Global)',
          accelerator: 'CmdOrCtrl+Shift+-',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:zoomOut')
          },
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.setIcon(join(__dirname, '../../icon.png'))
  }
  buildMenu()
  registerFsHandlers()
  registerCosmosSettingsHandlers()
  registerDevtoolsHandlers()
  registerSessionHandlers()
  const win = createWindow()
  const gitRunner = new GitRunner(win)
  gitRunner.registerHandlers()
  const gitWatcher = new GitWatcher(win)
  gitWatcher.registerHandlers()
  const ptyMgr = new PtyManager(win)
  ptyMgr.registerHandlers()
  const claudeMgr = new ClaudeManager(win)
  claudeMgr.registerHandlers()
  const mobileSrv = new MobileServer(win)
  mobileSrv.registerHandlers()
  const cosmosMgr = new CosmosManager(win)
  cosmosMgr.registerHandlers()
  const browserViewMgr = new BrowserViewManager(win)
  browserViewMgr.registerHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
