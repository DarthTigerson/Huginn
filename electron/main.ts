import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { readdir, readFile, writeFile } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { PtyManager } from './pty'
import { ClaudeManager } from './claude'

const execFileAsync = promisify(execFile)

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
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

async function getGitBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })
    const branch = stdout.trim()
    if (branch !== 'HEAD') return branch
    const { stdout: sha } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd })
    return sha.trim()
  } catch {
    return null
  }
}

function registerGitHandlers(): void {
  ipcMain.handle('git:branch', (_e, cwd: string) => getGitBranch(cwd))
}

function registerFsHandlers(): void {
  ipcMain.handle('fs:readDir', (_e, path: string) => buildTree(path))
  ipcMain.handle('fs:readFile', (_e, path: string) => readFile(path, 'utf-8'))
  ipcMain.handle('fs:writeFile', (_e, path: string, content: string) =>
    writeFile(path, content, 'utf-8')
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

app.whenReady().then(() => {
  registerFsHandlers()
  registerGitHandlers()
  const win = createWindow()
  const ptyMgr = new PtyManager(win)
  ptyMgr.registerHandlers()
  const claudeMgr = new ClaudeManager(win)
  claudeMgr.registerHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
