// Reads install.sh's own progress messages (VIDE-142). The script prints
// stages, not a percentage, so the Update page shows where it is rather
// than how far through.

export type UpdateStage = 'download' | 'install' | 'password'

export type UpdateFailure = 'admin-declined' | 'unsupported' | 'error'

// The stage a line moves the update into, or null if it doesn't change it.
export function stageFromLine(line: string): UpdateStage | null {
  const text = line.trim()
  if (/^Downloading vIDE/i.test(text)) return 'download'
  if (/Administrator rights are required/i.test(text)) return 'password'
  // "Installing to /Applications..." — and after the password step the
  // install carries on, so a later line from the swap counts as install.
  if (/^Installing to /i.test(text)) return 'install'
  return null
}

export function failureFromLog(lines: string[]): UpdateFailure {
  const text = lines.join('\n')
  if (/Update cancelled: administrator rights are required/i.test(text)) return 'admin-declined'
  if (/only ships an? .* build|Unsupported OS/i.test(text)) return 'unsupported'
  return 'error'
}

// extractVersionSection keeps the "## v0.2.20 (date)" heading; the page
// has its own "What's new in v0.2.20" title, so drop it.
export function changelogBody(section: string): string {
  return section.replace(/^##[^\n]*\n?/, '').trim()
}

// A short, scannable "What's new" for the Update page: the titled entries
// ("- **Silent alarms**: …" → "Silent alarms"), with untitled entries and
// bug fixes counted rather than listed — cutting long sentences down read
// badly. A release with no titled entries at all falls back to its first
// few lines, shortened. The full text stays one click away on the page.
export function changelogHighlights(body: string, maxLength = 64, fallbackCount = 4): {
  highlights: string[]
  otherChanges: number
  bugFixes: number
} {
  const titled: string[] = []
  const untitled: string[] = []
  let bugFixes = 0
  let inFixes = false
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (/^\*\*Bug fixes\*\*/i.test(line)) {
      inFixes = true
      continue
    }
    if (!line.startsWith('- ')) continue
    if (inFixes) {
      bugFixes++
      continue
    }
    const text = line.slice(2)
    const bold = text.match(/^\*\*(.+?)\*\*/)
    if (bold) titled.push(bold[1].replace(/:\s*$/, ''))
    else untitled.push(text.replace(/\*\*|`/g, ''))
  }
  if (titled.length > 0) return { highlights: titled, otherChanges: untitled.length, bugFixes }
  const shortened = untitled.slice(0, fallbackCount).map((t) => (t.length > maxLength ? t.slice(0, maxLength - 1).trimEnd() + '…' : t))
  return { highlights: shortened, otherChanges: untitled.length - shortened.length, bugFixes }
}
