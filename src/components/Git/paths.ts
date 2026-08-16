// A NUL byte (`\0`) can never appear in a real filesystem path, so a single
// `indexOf` unambiguously splits "repo root" from "everything else" even
// though both sides may themselves contain `/`.
const STAGED_PREFIX = 'git-diff://staged/'
const UNSTAGED_PREFIX = 'git-diff://unstaged/'
const SEP = '\0'

export function isGitDiffTab(path: string): boolean {
  return path.startsWith(STAGED_PREFIX) || path.startsWith(UNSTAGED_PREFIX)
}

export function buildGitDiffPath(repoRoot: string, filePath: string, staged: boolean): string {
  return (staged ? STAGED_PREFIX : UNSTAGED_PREFIX) + repoRoot + SEP + filePath
}

export function parseGitDiffPath(tabPath: string): { repoRoot: string; path: string; staged: boolean } {
  const staged = tabPath.startsWith(STAGED_PREFIX)
  const rest = staged ? tabPath.slice(STAGED_PREFIX.length) : tabPath.slice(UNSTAGED_PREFIX.length)
  const sepIndex = rest.indexOf(SEP)
  return { repoRoot: rest.slice(0, sepIndex), path: rest.slice(sepIndex + 1), staged }
}

const COMMIT_DIFF_PREFIX = 'git-commit-diff://'

export function isGitCommitDiffTab(path: string): boolean {
  return path.startsWith(COMMIT_DIFF_PREFIX)
}

export function buildGitCommitDiffPath(repoRoot: string, hash: string, filePath: string): string {
  return `${COMMIT_DIFF_PREFIX}${repoRoot}${SEP}${hash}/${filePath}`
}

export function parseGitCommitDiffPath(tabPath: string): { repoRoot: string; hash: string; path: string } {
  const rest = tabPath.slice(COMMIT_DIFF_PREFIX.length)
  const sepIndex = rest.indexOf(SEP)
  const repoRoot = rest.slice(0, sepIndex)
  const hashAndPath = rest.slice(sepIndex + 1)
  const slashIndex = hashAndPath.indexOf('/')
  return { repoRoot, hash: hashAndPath.slice(0, slashIndex), path: hashAndPath.slice(slashIndex + 1) }
}
