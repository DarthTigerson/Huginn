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
