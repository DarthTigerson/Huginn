import { describe, it, expect } from 'vitest'
import { countBacklog, countNotDone, sortTodoProjects } from '../todoProjectSort'
import type { Todo, TodoProject } from '@/types/api'

function project(id: string, name: string, createdAt: number): TodoProject {
  return { id, name, key: id.toUpperCase(), nextNumber: 1, createdAt }
}

function todo(projectId: string, status: Todo['status'], archived = false): Todo {
  return { projectId, status, archived } as Todo
}

const projects = [project('s', 'Snajja Maltin', 1), project('v', 'vIDE', 2), project('b', 'Bonnici Portfolio', 3)]

describe('countNotDone', () => {
  it('counts todos that are neither done nor archived', () => {
    expect(
      countNotDone([
        todo('v', 'backlog'),
        todo('v', 'todo'),
        todo('v', 'in_progress'),
        todo('v', 'done'),
        todo('v', 'todo', true),
      ])
    ).toBe(3)
  })
})

describe('countBacklog', () => {
  it('counts non-archived backlog todos only', () => {
    expect(countBacklog([todo('v', 'backlog'), todo('v', 'backlog', true), todo('v', 'todo')])).toBe(1)
  })
})

describe('sortTodoProjects', () => {
  it('sorts alphabetically, case-insensitively', () => {
    expect(sortTodoProjects(projects, 'alphabetical', {}).map((p) => p.id)).toEqual(['b', 's', 'v'])
  })

  it('sorts by creation date, oldest first', () => {
    expect(sortTodoProjects(projects, 'created', {}).map((p) => p.id)).toEqual(['s', 'v', 'b'])
  })

  it('sorts by not-done count, most first, ties alphabetical', () => {
    const todosByProject = {
      v: [todo('v', 'todo'), todo('v', 'in_progress'), todo('v', 'done')],
      s: [todo('s', 'backlog')],
    }
    expect(sortTodoProjects(projects, 'count', todosByProject).map((p) => p.id)).toEqual(['v', 's', 'b'])
  })

  it('sorts by backlog count, most first', () => {
    const todosByProject = {
      v: [todo('v', 'backlog'), todo('v', 'todo'), todo('v', 'todo')],
      b: [todo('b', 'backlog'), todo('b', 'backlog'), todo('b', 'backlog', true)],
    }
    expect(sortTodoProjects(projects, 'backlog', todosByProject).map((p) => p.id)).toEqual(['b', 'v', 's'])
  })

  it('breaks count ties alphabetically', () => {
    expect(sortTodoProjects(projects, 'count', {}).map((p) => p.id)).toEqual(['b', 's', 'v'])
  })

  it('does not mutate the input', () => {
    const input = [...projects]
    sortTodoProjects(input, 'alphabetical', {})
    expect(input).toEqual(projects)
  })
})
