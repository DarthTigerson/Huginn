import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
}

export interface SearchMatch {
  path: string
  line: number
  col: number
  text: string
}

export async function listAllFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      const children = await listAllFiles(fullPath)
      results.push(...children)
    } else {
      results.push(fullPath)
    }
  }
  return results
}

export async function searchText(root: string, query: string, caseSensitive: boolean): Promise<SearchMatch[]> {
  const allFiles = await listAllFiles(root)
  const results: SearchMatch[] = []
  const needle = caseSensitive ? query : query.toLowerCase()

  for (const filePath of allFiles) {
    if (results.length >= 1000) break
    try {
      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i]
        const haystack = caseSensitive ? raw : raw.toLowerCase()
        const col = haystack.indexOf(needle)
        if (col !== -1) {
          results.push({ path: filePath, line: i + 1, col: col + 1, text: raw })
          if (results.length >= 1000) break
        }
      }
    } catch {
      // skip binary or unreadable files
    }
  }
  return results
}

export async function buildTree(dirPath: string): Promise<FileNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  return entries
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory())
        return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((e) => ({
      name: e.name,
      path: join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }))
}
