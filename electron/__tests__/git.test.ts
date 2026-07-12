import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: () => {} },
}))

import { parsePorcelainStatus } from '../git'

describe('parsePorcelainStatus', () => {
  it('returns empty lists for no changes', () => {
    expect(parsePorcelainStatus('')).toEqual({ staged: [], unstaged: [] })
  })

  it('parses a staged modification', () => {
    const raw = 'M  src/foo.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/foo.ts', status: 'M' }],
      unstaged: [],
    })
  })

  it('parses an unstaged modification', () => {
    const raw = ' M src/foo.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [],
      unstaged: [{ path: 'src/foo.ts', status: 'M' }],
    })
  })

  it('parses a file staged and modified again (MM)', () => {
    const raw = 'MM src/foo.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/foo.ts', status: 'M' }],
      unstaged: [{ path: 'src/foo.ts', status: 'M' }],
    })
  })

  it('parses a staged addition', () => {
    const raw = 'A  src/new.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/new.ts', status: 'A' }],
      unstaged: [],
    })
  })

  it('parses an unstaged deletion', () => {
    const raw = ' D src/gone.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [],
      unstaged: [{ path: 'src/gone.ts', status: 'D' }],
    })
  })

  it('parses an untracked file', () => {
    const raw = '?? src/scratch.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [],
      unstaged: [{ path: 'src/scratch.ts', status: '?' }],
    })
  })

  it('parses a staged rename, skipping the old-path field and keeping the new path', () => {
    const raw = 'R  src/renamed.ts\0src/old-name.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'src/renamed.ts', status: 'R' }],
      unstaged: [],
    })
  })

  it('parses multiple mixed entries', () => {
    const raw = 'M  a.ts\0?? b.ts\0 D c.ts\0'
    expect(parsePorcelainStatus(raw)).toEqual({
      staged: [{ path: 'a.ts', status: 'M' }],
      unstaged: [
        { path: 'b.ts', status: '?' },
        { path: 'c.ts', status: 'D' },
      ],
    })
  })
})
