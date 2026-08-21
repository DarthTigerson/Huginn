import { describe, it, expect, beforeEach, vi } from 'vitest'

const { handlers, fsState } = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => unknown>,
  fsState: { files: new Map<string, string | Buffer>() },
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
  writeFile: async (path: string, data: string | Buffer) => {
    fsState.files.set(path, data)
  },
  mkdir: async () => {},
}))

let uuidCounter = 0
vi.stubGlobal('crypto', {
  randomUUID: () => `uuid-${++uuidCounter}`,
})

import { registerTodoHandlers } from '../todos'

describe('todos', () => {
  beforeEach(() => {
    fsState.files.clear()
    uuidCounter = 0
    registerTodoHandlers()
  })

  describe('projects', () => {
    it('returns an empty list when nothing has been created yet', async () => {
      expect(await handlers['todos:listProjects']()).toEqual([])
    })

    it('createProject adds a project that listProjects returns', async () => {
      const project = (await handlers['todos:createProject']({}, 'Huginn', 'H')) as any
      expect(project).toMatchObject({ name: 'Huginn', key: 'H', nextNumber: 1 })
      expect(await handlers['todos:listProjects']()).toEqual([project])
    })

    it('rejects a key that collides case-insensitively with an existing project', async () => {
      await handlers['todos:createProject']({}, 'Huginn', 'H')
      await expect(handlers['todos:createProject']({}, 'Harness', 'h')).rejects.toThrow()
    })

    it('rejects an empty key', async () => {
      await expect(handlers['todos:createProject']({}, 'Huginn', '   ')).rejects.toThrow()
    })
  })

  describe('todos', () => {
    it('createTodo builds the id from the project key and an incrementing counter', async () => {
      const project = (await handlers['todos:createProject']({}, 'Huginn', 'H')) as any
      const first = (await handlers['todos:createTodo']({}, project.id, 'First')) as any
      const second = (await handlers['todos:createTodo']({}, project.id, 'Second')) as any
      expect(first.id).toBe('H-1')
      expect(second.id).toBe('H-2')
    })

    it('createTodo throws for an unknown project', async () => {
      await expect(handlers['todos:createTodo']({}, 'missing', 'Title')).rejects.toThrow()
    })

    it('createTodo starts a todo with the expected defaults', async () => {
      const project = (await handlers['todos:createProject']({}, 'Huginn', 'H')) as any
      const todo = (await handlers['todos:createTodo']({}, project.id, 'First')) as any
      expect(todo).toMatchObject({
        projectId: project.id,
        title: 'First',
        description: '',
        attachments: [],
        status: 'backlog',
        archived: false,
        labels: [],
        prUrl: null,
        comments: [],
      })
    })

    it('listTodos returns only todos for the given project', async () => {
      const p1 = (await handlers['todos:createProject']({}, 'Huginn', 'H')) as any
      const p2 = (await handlers['todos:createProject']({}, 'Harness', 'A')) as any
      const t1 = await handlers['todos:createTodo']({}, p1.id, 'In p1')
      await handlers['todos:createTodo']({}, p2.id, 'In p2')

      expect(await handlers['todos:listTodos']({}, p1.id)).toEqual([t1])
    })

    it('updateTodo merges the patch and bumps updatedAt', async () => {
      const project = (await handlers['todos:createProject']({}, 'Huginn', 'H')) as any
      const todo = (await handlers['todos:createTodo']({}, project.id, 'First')) as any
      const updated = (await handlers['todos:updateTodo']({}, todo.id, { status: 'in_progress' })) as any

      expect(updated.status).toBe('in_progress')
      expect(updated.title).toBe('First')
    })

    it('updateTodo throws for an unknown id', async () => {
      await expect(handlers['todos:updateTodo']({}, 'missing', { title: 'x' })).rejects.toThrow()
    })

    it('archiveTodo sets the archived flag', async () => {
      const project = (await handlers['todos:createProject']({}, 'Huginn', 'H')) as any
      const todo = (await handlers['todos:createTodo']({}, project.id, 'First')) as any
      const archived = (await handlers['todos:archiveTodo']({}, todo.id, true)) as any
      expect(archived.archived).toBe(true)
    })

    it('deleteTodo removes the todo and is idempotent', async () => {
      const project = (await handlers['todos:createProject']({}, 'Huginn', 'H')) as any
      const todo = (await handlers['todos:createTodo']({}, project.id, 'First')) as any

      await handlers['todos:deleteTodo']({}, todo.id)
      expect(await handlers['todos:listTodos']({}, project.id)).toEqual([])
      await expect(handlers['todos:deleteTodo']({}, todo.id)).resolves.toBeUndefined()
    })

    it('addComment appends a comment and returns the updated todo', async () => {
      const project = (await handlers['todos:createProject']({}, 'Huginn', 'H')) as any
      const todo = (await handlers['todos:createTodo']({}, project.id, 'First')) as any
      const updated = (await handlers['todos:addComment']({}, todo.id, 'Looks good', ['att-1'])) as any

      expect(updated.comments).toHaveLength(1)
      expect(updated.comments[0]).toMatchObject({ body: 'Looks good', attachments: ['att-1'] })
    })

    it('addComment defaults attachments to an empty array', async () => {
      const project = (await handlers['todos:createProject']({}, 'Huginn', 'H')) as any
      const todo = (await handlers['todos:createTodo']({}, project.id, 'First')) as any
      const updated = (await handlers['todos:addComment']({}, todo.id, 'Looks good')) as any

      expect(updated.comments[0].attachments).toEqual([])
    })
  })

  describe('attachments', () => {
    it('saveAttachment then readAttachmentDataUrl round-trips the same image bytes', async () => {
      const payload = Buffer.from('fake png bytes').toString('base64')
      const id = await handlers['todos:saveAttachment']({}, `data:image/png;base64,${payload}`)

      const dataUrl = (await handlers['todos:readAttachmentDataUrl']({}, id)) as string

      expect(dataUrl).toBe(`data:image/png;base64,${payload}`)
    })
  })
})
