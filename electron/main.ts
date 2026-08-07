import { app, BrowserWindow, ipcMain, dialog, Menu, shell, webContents } from 'electron'
import { basename, join } from 'path'
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

const windows = new Map<number, BrowserWindow>()

function createWindow(projectRoot?: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: projectRoot ? basename(projectRoot) : 'Huginn',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  windows.set(win.id, win)
  win.once('ready-to-show', () => win.show())
  win.on('focus', () => buildMenu())
  win.on('closed', () => {
    windows.delete(win.id)
    ptyMgr.disposeWindow(win.id)
    claudeMgr.disposeWindow(win.id)
    gitWatcher.disposeWindow(win.id)
    cosmosMgr.disposeWindow(win.id)
    browserViewMgr.disposeWindow(win.id)
    buildMenu()
  })

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

  if (projectRoot) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('menu:openInitialProject', projectRoot)
    })
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
        {
          label: 'Preferences…',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:openSettings')
          },
        },
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
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:newFile')
          },
        },
        {
          label: 'New Folder',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:newFolder')
          },
        },
        {
          label: 'New Terminal',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:newTerminal')
          },
        },
        { type: 'separator' },
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:openProject')
          },
        },
        { type: 'separator' },
        {
          label: 'Reopen Closed Tab',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:reopenClosedTab')
          },
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:save')
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
        { role: 'close', label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W' },
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
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:find')
          },
        },
        {
          label: 'Find in Files',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:findInFiles')
          },
        },
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
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:toggleSidebar')
          },
        },
        {
          label: 'Command Palette…',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:commandPalette')
          },
        },
        {
          label: 'Action Palette…',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:actionPalette')
          },
        },
        {
          label: 'Toggle Claude Chat',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:toggleClaudeChat')
          },
        },
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

let ptyMgr: PtyManager
let claudeMgr: ClaudeManager
let gitWatcher: GitWatcher
let cosmosMgr: CosmosManager
let browserViewMgr: BrowserViewManager

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.setIcon(join(__dirname, '../../icon.png'))
  }

  registerFsHandlers()
  registerCosmosSettingsHandlers()
  registerDevtoolsHandlers()
  registerSessionHandlers()

  ptyMgr = new PtyManager()
  ptyMgr.registerHandlers()
  claudeMgr = new ClaudeManager()
  claudeMgr.registerHandlers()
  const gitRunner = new GitRunner()
  gitRunner.registerHandlers()
  gitWatcher = new GitWatcher()
  gitWatcher.registerHandlers()
  cosmosMgr = new CosmosManager()
  cosmosMgr.registerHandlers()
  browserViewMgr = new BrowserViewManager()
  browserViewMgr.registerHandlers()

  buildMenu()
  createWindow()

  // MobileServer (deliberately left untouched — an app-wide singleton per the
  // spec, not per-window) pushes 'mobile:state' events to whatever `win` it
  // was constructed with. With multiple real windows there's no single
  // correct target — its state is account-level (pairing PIN, usage stats),
  // not tied to any one project — so give it a fake win-shaped object whose
  // webContents.send() broadcasts to every currently-open window instead.
  const mobileSrv = new MobileServer({
    webContents: {
      send: (...args: unknown[]) => {
        for (const w of windows.values()) {
          if (!w.isDestroyed()) (w.webContents.send as (...a: unknown[]) => void)(...args)
        }
      },
    },
  } as unknown as BrowserWindow)
  mobileSrv.registerHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
