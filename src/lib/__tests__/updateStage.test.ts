import { describe, it, expect } from 'vitest'
import { stageFromLine, failureFromLog, changelogBody } from '../updateStage'

describe('stageFromLine', () => {
  it('maps install.sh messages to stages (macOS and Linux wording)', () => {
    expect(stageFromLine('Downloading vIDE...')).toBe('download')
    expect(stageFromLine('Installing to /Applications...')).toBe('install')
    expect(stageFromLine('Installing to /home/me/.local/share/vIDE...')).toBe('install')
    expect(stageFromLine('Administrator rights are required to update vIDE in /Applications.')).toBe('password')
  })

  it('ignores anything else', () => {
    expect(stageFromLine('vIDE installed.')).toBeNull()
    expect(stageFromLine('random output')).toBeNull()
  })
})

describe('failureFromLog', () => {
  it('recognises a declined admin prompt', () => {
    expect(failureFromLog(['Update cancelled: administrator rights are required.'])).toBe('admin-declined')
  })

  it('recognises an unsupported machine', () => {
    expect(failureFromLog(["vIDE only ships an Apple Silicon (arm64) build right now — Intel Macs aren't supported yet."])).toBe('unsupported')
    expect(failureFromLog(['Unsupported OS: freebsd'])).toBe('unsupported')
  })

  it('falls back to a generic error', () => {
    expect(failureFromLog(['curl: (6) Could not resolve host'])).toBe('error')
  })
})

describe('changelogBody', () => {
  it('drops the version heading', () => {
    expect(changelogBody('## v0.2.20 (2026-10-08)\n- one\n- two')).toBe('- one\n- two')
  })
})
