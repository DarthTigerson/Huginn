import { describe, it, expect } from 'vitest'
import { stageFromLine, failureFromLog, changelogBody, changelogHighlights } from '../updateStage'

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

describe('changelogHighlights', () => {
  const body = [
    '- **Silent alarms**: click the clock to set alarms',
    '- **Notification bell with a count**: a bell next to the clock',
    '- The git activity bar now runs just above the footer instead of over its top border',
    '- Removed the rotating footer hints',
    '',
    '**Bug fixes**',
    '- Fixed one thing',
    '- Fixed another',
  ].join('\n')

  it('lists the titled entries and counts the rest instead of cutting them short', () => {
    expect(changelogHighlights(body)).toEqual({
      highlights: ['Silent alarms', 'Notification bell with a count'],
      otherChanges: 2,
      bugFixes: 2,
    })
  })

  it('falls back to the first few shortened lines when nothing is titled', () => {
    const plain = '- Improved autocomplete logic and ui\n- Implement graphify to reduce claude token usage as well as speed up usage across the app'
    const result = changelogHighlights(plain, 40)
    expect(result.highlights[0]).toBe('Improved autocomplete logic and ui')
    expect(result.highlights[1]).toBe("Implement graphify to reduce claude tok…")
    expect(result.otherChanges).toBe(0)
  })
})

