import { describe, it, expect, beforeEach, vi } from 'vitest'

const { handlers, fsState } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => unknown>,
  fsState: { files: new Map<string, string>() },
}))

vi.mock('electron', () => ({
  app: { getPath: () => '/fake/userData' },
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => unknown) => {
      handlers[channel] = fn
    },
  },
}))

vi.mock('fs/promises', () => ({
  readFile: async (path: string) => {
    if (!fsState.files.has(path)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    return fsState.files.get(path)!
  },
  writeFile: async (path: string, data: string) => {
    fsState.files.set(path, data)
  },
  mkdir: async () => {},
}))

import { registerRecentProjectsHandlers } from '../recentProjects'

describe('recentProjects', () => {
  beforeEach(() => {
    fsState.files.clear()
    registerRecentProjectsHandlers()
  })

  it('returns an empty list when nothing has been added yet', async () => {
    const result = await handlers['recentProjects:list']()
    expect(result).toEqual([])
  })

  it('add() inserts a new entry that list() returns', async () => {
    await handlers['recentProjects:add']({}, '/repo/a')
    const result = (await handlers['recentProjects:list']()) as { path: string }[]
    expect(result.map((r) => r.path)).toEqual(['/repo/a'])
  })

  it('re-adding an existing path moves it to the front instead of duplicating it', async () => {
    await handlers['recentProjects:add']({}, '/repo/a')
    await handlers['recentProjects:add']({}, '/repo/b')
    await handlers['recentProjects:add']({}, '/repo/a')
    const result = (await handlers['recentProjects:list']()) as { path: string }[]
    expect(result.map((r) => r.path)).toEqual(['/repo/a', '/repo/b'])
  })

  it('caps the list at 10 entries, dropping the oldest', async () => {
    for (let i = 0; i < 12; i++) {
      await handlers['recentProjects:add']({}, `/repo/${i}`)
    }
    const result = (await handlers['recentProjects:list']()) as { path: string }[]
    expect(result).toHaveLength(10)
    expect(result[0].path).toBe('/repo/11')
    expect(result.map((r) => r.path)).not.toContain('/repo/0')
    expect(result.map((r) => r.path)).not.toContain('/repo/1')
  })

  it('clear() empties the list', async () => {
    await handlers['recentProjects:add']({}, '/repo/a')
    await handlers['recentProjects:clear']()
    const result = await handlers['recentProjects:list']()
    expect(result).toEqual([])
  })
})
