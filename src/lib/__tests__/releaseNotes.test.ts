import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseReleaseNotes, isNewerVersion } from '../releaseNotes'
import { parseChangelog } from '../../../electron/changelog'

describe('parseReleaseNotes', () => {
  it('splits titled features, untitled changes and bug fixes', () => {
    const body = [
      '- **Silent alarms**: click the clock to set alarms',
      '- **Close Others** in the tab right-click menu closes every other tab',
      '- The git activity bar now runs just above the footer',
      '',
      '**Bug fixes**',
      '- Fixed a deleted project coming back',
    ].join('\n')
    expect(parseReleaseNotes(body)).toEqual({
      features: [
        { title: 'Silent alarms', text: 'click the clock to set alarms' },
        { title: 'Close Others', text: 'in the tab right-click menu closes every other tab' },
      ],
      changes: ['The git activity bar now runs just above the footer'],
      fixes: ['Fixed a deleted project coming back'],
    })
  })

  it('handles a colon inside the bold title', () => {
    expect(parseReleaseNotes('- **Mobile Display: full vIDE client**: pairing now offers a choice').features).toEqual([
      { title: 'Mobile Display: full vIDE client', text: 'pairing now offers a choice' },
    ])
  })

  it('accounts for every entry of every real release', () => {
    const releases = parseChangelog(readFileSync(resolve(__dirname, '../../../CHANGELOG.md'), 'utf-8'))
    expect(releases.length).toBeGreaterThan(20)
    for (const r of releases) {
      const entries = r.body.split('\n').filter((l) => l.trim().startsWith('- ')).length
      const notes = parseReleaseNotes(r.body)
      expect(notes.features.length + notes.changes.length + notes.fixes.length, `v${r.version}`).toBe(entries)
      for (const f of notes.features) expect(f.title, `v${r.version}`).not.toMatch(/\*\*|:$/)
    }
  })
})

describe('isNewerVersion', () => {
  it('compares segment by segment, not as text', () => {
    expect(isNewerVersion('0.2.20', '0.2.9')).toBe(true)
    expect(isNewerVersion('0.2.9', '0.2.20')).toBe(false)
    expect(isNewerVersion('0.3.0', '0.2.99')).toBe(true)
    expect(isNewerVersion('0.2.20', '0.2.20')).toBe(false)
    expect(isNewerVersion('1.0', '0.9.9')).toBe(true)
  })
})

