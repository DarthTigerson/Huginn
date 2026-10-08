// Splits one release's CHANGELOG notes into the parts Settings > About lays
// out (VIDE-143): titled features ("- **Silent alarms**: …"), untitled
// changes, and bug fixes. Each entry is a single "- " line in the changelog.

export interface ReleaseNoteFeature {
  title: string
  text: string // the description after the title, still markdown
}

export interface ReleaseNotes {
  features: ReleaseNoteFeature[]
  changes: string[] // untitled entries, markdown
  fixes: string[]
}

export function parseReleaseNotes(body: string): ReleaseNotes {
  const notes: ReleaseNotes = { features: [], changes: [], fixes: [] }
  let inFixes = false
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (/^\*\*Bug fixes\*\*$/i.test(line)) {
      inFixes = true
      continue
    }
    if (!line.startsWith('- ')) continue
    const entry = line.slice(2).trim()
    if (inFixes) {
      notes.fixes.push(entry)
      continue
    }
    const titled = entry.match(/^\*\*(.+?):?\*\*:?\s*(.*)$/)
    if (titled) notes.features.push({ title: titled[1].replace(/:$/, ''), text: titled[2] })
    else notes.changes.push(entry)
  }
  return notes
}
