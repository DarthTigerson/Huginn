import { app, ipcMain } from 'electron'
import { join } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'

export interface RecentProject {
  path: string
  lastOpened: number
}

const MAX_RECENTS = 10

function recentsPath(): string {
  return join(app.getPath('userData'), 'recent-projects.json')
}

export async function readRecents(): Promise<RecentProject[]> {
  try {
    const data = await readFile(recentsPath(), 'utf-8')
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeRecents(recents: RecentProject[]): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(recentsPath(), JSON.stringify(recents), 'utf-8')
}

export async function addRecentProject(path: string): Promise<void> {
  const recents = await readRecents()
  const withoutPath = recents.filter((r) => r.path !== path)
  const updated = [{ path, lastOpened: Date.now() }, ...withoutPath].slice(0, MAX_RECENTS)
  await writeRecents(updated)
}

export async function clearRecentProjects(): Promise<void> {
  await writeRecents([])
}

export function registerRecentProjectsHandlers(): void {
  ipcMain.handle('recentProjects:list', async () => readRecents())
  ipcMain.handle('recentProjects:add', async (_e, path: string) => addRecentProject(path))
  ipcMain.handle('recentProjects:clear', async () => clearRecentProjects())
}
