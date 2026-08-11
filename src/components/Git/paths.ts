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

const COMMIT_DIFF_PREFIX = 'git-commit-diff://'

export function isGitCommitDiffTab(path: string): boolean {
  return path.startsWith(COMMIT_DIFF_PREFIX)
}

export function buildGitCommitDiffPath(hash: string, filePath: string): string {
  return `${COMMIT_DIFF_PREFIX}${hash}/${filePath}`
}

export function parseGitCommitDiffPath(tabPath: string): { hash: string; path: string } {
  const rest = tabPath.slice(COMMIT_DIFF_PREFIX.length)
  const slashIndex = rest.indexOf('/')
  return { hash: rest.slice(0, slashIndex), path: rest.slice(slashIndex + 1) }
}
