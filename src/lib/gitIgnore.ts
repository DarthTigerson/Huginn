// ignoredPaths comes from `git ls-files --others --ignored --exclude-standard
// --directory`, so entries are project-root-relative and an ignored
// directory is collapsed to a single entry (e.g. "node_modules" covers
// everything inside it).
export function isIgnoredPath(nodePath: string, projectRoot: string, ignoredPaths: string[]): boolean {
  if (ignoredPaths.length === 0) return false
  const relPath = nodePath.startsWith(projectRoot + '/')
    ? nodePath.slice(projectRoot.length + 1)
    : nodePath
  return ignoredPaths.some((ignored) => relPath === ignored || relPath.startsWith(ignored + '/'))
}
