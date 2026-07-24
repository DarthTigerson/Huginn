import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { access, mkdir, readdir, readFile, rename, writeFile } from 'fs/promises'
import { PtyManager } from './pty'
import { ClaudeManager } from './claude'
import { GitRunner } from './gitRunner'
import { MobileServer } from './mobile'

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
}

interface SearchMatch {
  path: string
  line: number
  col: number
  text: string
}

async function listAllFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      const children = await listAllFiles(fullPath)
      results.push(...children)
    } else {
      results.push(fullPath)
    }
  }
  return results
}

async function searchText(root: string, query: string, caseSensitive: boolean): Promise<SearchMatch[]> {
  const allFiles = await listAllFiles(root)
  const results: SearchMatch[] = []
  const needle = caseSensitive ? query : query.toLowerCase()

  for (const filePath of allFiles) {
    if (results.length >= 1000) break
    try {
      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i]
        const haystack = caseSensitive ? raw : raw.toLowerCase()
        const col = haystack.indexOf(needle)
        if (col !== -1) {
          results.push({ path: filePath, line: i + 1, col: col + 1, text: raw })
          if (results.length >= 1000) break
        }
      }
    } catch {
      // skip binary or unreadable files
    }
  }
  return results
}

async function buildTree(dirPath: string): Promise<FileNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  return entries
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory())
        return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((e) => ({
      name: e.name,
      path: join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }))
}

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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.name = 'Huginn'

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
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
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
  buildMenu()
  registerFsHandlers()
  const win = createWindow()
  const gitRunner = new GitRunner(win)
  gitRunner.registerHandlers()
  const ptyMgr = new PtyManager(win)
  ptyMgr.registerHandlers()
  const claudeMgr = new ClaudeManager(win)
  claudeMgr.registerHandlers()
  const mobileSrv = new MobileServer(win)
  mobileSrv.registerHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
