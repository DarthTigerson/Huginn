import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

import { UpdateRunner, UPDATE_SCRIPT, createLineSplitter, fetchRemoteChangelog } from '../updateRunner'

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter }
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  return child
}

function fakeTarget() {
  const sent: Array<[string, unknown]> = []
  return { sent, target: { isDestroyed: () => false, send: (c: string, p: unknown) => sent.push([c, p]) } }
}

describe('UPDATE_SCRIPT', () => {
  it('fails the pipe when the download fails (pipefail) and stops install.sh relaunching the app', () => {
    expect(UPDATE_SCRIPT).toMatch(/^set -o pipefail;/)
    expect(UPDATE_SCRIPT).toContain('VIDE_NO_LAUNCH=1')
    expect(UPDATE_SCRIPT).toMatch(/curl -fsSL https:\/\/raw\.githubusercontent\.com\/DarthTigerson\/vIDE\/main\/install\.sh \| bash$/)
  })
})

describe('createLineSplitter', () => {
  it('emits whole lines, holding a partial one until it completes, and skips blanks', () => {
    const lines: string[] = []
    const s = createLineSplitter((l) => lines.push(l))
    s.push('Downloading vI')
    expect(lines).toEqual([])
    s.push('DE...\n\nInstalling to /Applications...\r\nvIDE inst')
    s.flush()
    expect(lines).toEqual(['Downloading vIDE...', 'Installing to /Applications...', 'vIDE inst'])
  })
})

describe('UpdateRunner', () => {
  it('streams stdout/stderr lines and the exit code to the window that started it', () => {
    const child = fakeChild()
    const spawnScript = vi.fn(() => child as never)
    const runner = new UpdateRunner(spawnScript)
    const { sent, target } = fakeTarget()

    runner.run(target as never)
    expect(spawnScript).toHaveBeenCalledWith(UPDATE_SCRIPT)
    child.stdout.emit('data', Buffer.from('Downloading vIDE...\n'))
    child.stderr.emit('data', Buffer.from('Update cancelled: administrator rights are required.\n'))
    child.emit('close', 1)

    expect(sent).toEqual([
      ['update:output', { line: 'Downloading vIDE...', stream: 'stdout' }],
      ['update:output', { line: 'Update cancelled: administrator rights are required.', stream: 'stderr' }],
      ['update:exit', 1],
    ])
    expect(runner.running).toBe(false)
  })

  it('ignores a second run while one is in flight', () => {
    const spawnScript = vi.fn(() => fakeChild() as never)
    const runner = new UpdateRunner(spawnScript)
    runner.run(fakeTarget().target as never)
    runner.run(fakeTarget().target as never)
    expect(spawnScript).toHaveBeenCalledTimes(1)
  })

  it('reports a spawn error as a failed run, once', () => {
    const child = fakeChild()
    const runner = new UpdateRunner(() => child as never)
    const { sent, target } = fakeTarget()
    runner.run(target as never)
    child.emit('error', new Error('bash not found'))
    child.emit('close', null)
    expect(sent.filter(([c]) => c === 'update:exit')).toEqual([['update:exit', 1]])
    expect(sent[0]).toEqual(['update:output', { line: "Couldn't start the update: bash not found", stream: 'stderr' }])
  })

  it('does not send to a window that has gone away', () => {
    const child = fakeChild()
    const runner = new UpdateRunner(() => child as never)
    const send = vi.fn()
    runner.run({ isDestroyed: () => true, send } as never)
    child.emit('close', 0)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('fetchRemoteChangelog', () => {
  const CHANGELOG = '# vIDE\n## v0.2.20 (2026-10-08)\n- **Alarms**: new\n\n## v0.2.19 (2026-09-29)\n- old\n'

  it('returns just the requested version\'s section from the repo\'s CHANGELOG', async () => {
    const fetcher = vi.fn(async () => new Response(CHANGELOG)) as unknown as typeof fetch
    expect(await fetchRemoteChangelog('0.2.20', fetcher)).toBe('## v0.2.20 (2026-10-08)\n- **Alarms**: new')
    expect(fetcher).toHaveBeenCalledWith('https://raw.githubusercontent.com/DarthTigerson/vIDE/main/CHANGELOG.md')
  })

  it('returns null on an HTTP error or network failure', async () => {
    expect(await fetchRemoteChangelog('0.2.20', (async () => new Response('', { status: 404 })) as unknown as typeof fetch)).toBeNull()
    expect(await fetchRemoteChangelog('0.2.20', (async () => { throw new Error('offline') }) as unknown as typeof fetch)).toBeNull()
  })
})
