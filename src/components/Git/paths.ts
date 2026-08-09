const STAGED_PREFIX = 'git-diff://staged/'
const UNSTAGED_PREFIX = 'git-diff://unstaged/'

export function isGitDiffTab(path: string): boolean {
  return path.startsWith(STAGED_PREFIX) || path.startsWith(UNSTAGED_PREFIX)
}

export function buildGitDiffPath(filePath: string, staged: boolean): string {
  return (staged ? STAGED_PREFIX : UNSTAGED_PREFIX) + filePath
}

export function parseGitDiffPath(tabPath: string): { path: string; staged: boolean } {
  if (tabPath.startsWith(STAGED_PREFIX)) {
    return { path: tabPath.slice(STAGED_PREFIX.length), staged: true }
  }
  return { path: tabPath.slice(UNSTAGED_PREFIX.length), staged: false }
}
