import { readFile } from 'fs/promises'
import { join } from 'path'

// Same "packaged files land at the app root" pattern used for icon.png
// (see main.ts's dock icon path) — out/main/index.js is two levels below
// the root both in dev and in a packaged app.asar.
const CHANGELOG_PATH = join(__dirname, '../../CHANGELOG.md')

export function extractVersionSection(changelog: string, version: string): string | null {
  const lines = changelog.split('\n')
  const startIdx = lines.findIndex((line) => {
    const match = line.match(/^##\s+v?([\d.]+)/)
    return match?.[1] === version
  })
  if (startIdx === -1) return null

  let endIdx = lines.length
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s+v?[\d.]+/.test(lines[i])) {
      endIdx = i
      break
    }
  }

  return lines.slice(startIdx, endIdx).join('\n').trim()
}

export async function getChangelogForVersion(version: string): Promise<string | null> {
  try {
    const changelog = await readFile(CHANGELOG_PATH, 'utf-8')
    return extractVersionSection(changelog, version)
  } catch {
    return null
  }
}
