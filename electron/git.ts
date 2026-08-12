import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'
import { join } from 'path'

const execFileAsync = promisify(execFile)

export interface GitFileEntry {
  path: string
  status: 'M' | 'A' | 'D' | 'R' | '?'
}

export interface GitStatus {
  staged: GitFileEntry[]
  unstaged: GitFileEntry[]
}

export interface GitAheadBehind {
  ahead: number
  behind: number
}

export async function getGitBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })
    const branch = stdout.trim()
    if (branch !== 'HEAD') return branch
    const { stdout: sha } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd })
    return sha.trim()
  } catch {
    return null
  }
}

// Resolves the repo's actual default branch (e.g. "origin/main") by asking
// the remote directly via `ls-remote --symref` — a single lightweight ref
// lookup, no object transfer. This is deliberately NOT read from the
// locally-cached refs/remotes/origin/HEAD symbolic ref: that ref is only
// written at clone time (or by an explicit `git remote set-head origin -a`)
// and is never refreshed by fetch/pull, so if the default branch is changed
// on the host after the clone (e.g. a master->main rename), every existing
// clone's cached copy goes silently stale and keeps pointing at the old
// branch — confidently wrong, rather than falling through to the heuristic
// fallback in chooseTarget(). Bounded by a short timeout so an unreachable
// remote (offline, VPN, slow network) can't stall the branch-list load;
// on any failure we fall back to the local cache, then to null so callers
// keep their own heuristic fallback (origin/main, origin/master, ...).
export async function getDefaultBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['ls-remote', '--symref', 'origin', 'HEAD'],
      { cwd, timeout: 3000 }
    )
    const match = stdout.match(/^ref:\s+refs\/heads\/(\S+)\s+HEAD/m)
    if (match) return `origin/${match[1]}`
  } catch {
    // Unreachable remote, no origin, or timed out — fall through to the
    // local cache below.
  }

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
      { cwd }
    )
    return stdout.trim() || null
  } catch {
    return null
  }
}

// Runs a plain `git fetch` and reports only success/failure — used for
// automatic background fetches (periodic, on repo open, on branch switch)
// that must never surface output the way the user-triggered Fetch button
// does (which streams through GitRunner into the Git Log tab). Bounded by a
// timeout so a slow/unreachable remote can't hang the caller indefinitely;
// any failure (offline, auth prompt, timeout) is swallowed since callers
// treat this as best-effort.
export async function fetchRemote(cwd: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['fetch'], { cwd, timeout: 15000 })
    return true
  } catch {
    return false
  }
}

export async function getGitBranches(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes'],
      { cwd }
    )
    return Array.from(
      new Set(
        stdout
          .split('\n')
          .map((branch) => branch.trim())
          .filter((branch) => branch && !branch.endsWith('/HEAD'))
      )
    )
  } catch {
    return []
  }
}

export interface GitBranchList {
  current: string | null
  local: string[]
  remote: string[]
}

// Remote branches whose short name (after stripping the "origin/" prefix)
// already has a local branch are omitted — they'd just be checkout-noise
// duplicating an entry the Local section already lists.
export async function getBranchList(cwd: string): Promise<GitBranchList> {
  try {
    const [{ stdout: localOut }, { stdout: remoteOut }, current] = await Promise.all([
      execFileAsync('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads'], { cwd }),
      execFileAsync('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes'], { cwd }),
      getGitBranch(cwd),
    ])
    const local = localOut.split('\n').map((b) => b.trim()).filter(Boolean)
    const localSet = new Set(local)
    const remote = remoteOut
      .split('\n')
      .map((b) => b.trim())
      .filter((ref) => ref && !ref.endsWith('/HEAD'))
      .filter((ref) => !localSet.has(ref.slice(ref.indexOf('/') + 1)))
    return { current, local, remote }
  } catch {
    return { current: null, local: [], remote: [] }
  }
}

export async function getAheadBehind(cwd: string): Promise<GitAheadBehind | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'],
      { cwd }
    )
    const [behind, ahead] = stdout.trim().split(/\s+/).map(Number)
    return { ahead, behind }
  } catch {
    return null
  }
}

function toStatus(code: string): GitFileEntry['status'] {
  return code === 'A' || code === 'D' || code === 'R' ? code : 'M'
}

export function parsePorcelainStatus(raw: string): GitStatus {
  const staged: GitFileEntry[] = []
  const unstaged: GitFileEntry[] = []
  if (!raw) return { staged, unstaged }

  const entries = raw.split('\0').filter(Boolean)
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const x = entry[0]
    const y = entry[1]
    const path = entry.slice(3)

    if (x === 'R') {
      // porcelain -z emits the old path as a separate NUL-terminated
      // field right after a rename entry — skip over it
      i++
    }

    if (x === '?' && y === '?') {
      unstaged.push({ path, status: '?' })
      continue
    }

    if (x !== ' ' && x !== '?') {
      staged.push({ path, status: toStatus(x) })
    }
    if (y !== ' ' && y !== '?') {
      unstaged.push({ path, status: toStatus(y) })
    }
  }

  return { staged, unstaged }
}

export async function getGitStatus(cwd: string): Promise<GitStatus> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain=v1', '-z'], { cwd })
    return parsePorcelainStatus(stdout)
  } catch {
    return { staged: [], unstaged: [] }
  }
}

// --directory collapses a whole ignored directory (e.g. node_modules) into a
// single entry instead of every file inside it — exactly what the sidebar
// tree needs to dim a folder without listing thousands of descendants.
export async function getIgnoredPaths(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'],
      { cwd }
    )
    return stdout.split('\0').filter(Boolean).map((path) => path.replace(/\/$/, ''))
  } catch {
    return []
  }
}

export async function stageFiles(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await execFileAsync('git', ['add', '--', ...paths], { cwd })
}

export async function discardFileChanges(cwd: string, path: string): Promise<void> {
  await execFileAsync('git', ['checkout', '--', path], { cwd })
}

export async function unstageFiles(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await execFileAsync('git', ['reset', '--', ...paths], { cwd })
}

export async function stageAll(cwd: string): Promise<void> {
  await execFileAsync('git', ['add', '-A'], { cwd })
}

export async function unstageAll(cwd: string): Promise<void> {
  await execFileAsync('git', ['reset'], { cwd })
}

export async function commit(
  cwd: string,
  message: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await execFileAsync('git', ['commit', '-m', message], { cwd })
    return { ok: true }
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr
    return { ok: false, error: stderr?.trim() || 'Commit failed' }
  }
}

async function showRef(cwd: string, ref: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['show', ref], { cwd })
    return stdout
  } catch {
    return ''
  }
}

export async function getGitGraph(cwd: string): Promise<import('../src/types/index').GitCommit[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--all', '-n', '100', '--pretty=format:%H|%P|%s|%an|%ai|%D'],
      { cwd }
    )
    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const pipeIdx = line.indexOf('|')
        const hash = line.slice(0, pipeIdx)
        const rest = line.slice(pipeIdx + 1)
        const parts = rest.split('|')
        const parentsRaw = parts[0] ?? ''
        const subject = parts[1] ?? ''
        const author = parts[2] ?? ''
        const date = parts[3] ?? ''
        const refsRaw = parts[4] ?? ''
        const parents = parentsRaw.trim() ? parentsRaw.trim().split(' ').filter(Boolean) : []
        const refs = refsRaw.trim()
          ? refsRaw.split(',').map((r) => r.trim()).filter(Boolean)
          : []
        return { hash, parents, subject, author, date, refs }
      })
  } catch {
    return []
  }
}

export async function getGitBranchDiff(
  cwd: string,
  source: string,
  target: string
): Promise<import('../src/types/index').GitBranchDiff> {
  if (!source || !target || source === target) {
    return { source, target, commits: [] }
  }

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', `${target}..${source}`, '-n', '200', '--pretty=format:%H|%P|%s|%an|%ai|%D'],
      { cwd }
    )
    const commits = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const pipeIdx = line.indexOf('|')
        const hash = line.slice(0, pipeIdx)
        const rest = line.slice(pipeIdx + 1)
        const parts = rest.split('|')
        const parentsRaw = parts[0] ?? ''
        const subject = parts[1] ?? ''
        const author = parts[2] ?? ''
        const date = parts[3] ?? ''
        const refsRaw = parts[4] ?? ''
        const parents = parentsRaw.trim() ? parentsRaw.trim().split(' ').filter(Boolean) : []
        const refs = refsRaw.trim()
          ? refsRaw.split(',').map((r) => r.trim()).filter(Boolean)
          : []
        return { hash, parents, subject, author, date, refs }
      })
    return { source, target, commits }
  } catch {
    return { source, target, commits: [] }
  }
}

export async function getGitShowStat(cwd: string, hash: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['show', '--name-only', '--format=', hash],
      { cwd }
    )
    return stdout.split('\n').map((l) => l.trim()).filter(Boolean)
  } catch {
    return []
  }
}

export async function getDiffContent(
  cwd: string,
  path: string,
  staged: boolean
): Promise<{ original: string; modified: string }> {
  if (staged) {
    const original = await showRef(cwd, `HEAD:${path}`)
    const modified = await showRef(cwd, `:${path}`)
    return { original, modified }
  }

  const original = await showRef(cwd, `:${path}`)
  let modified = ''
  try {
    modified = await readFile(join(cwd, path), 'utf-8')
  } catch {
    modified = ''
  }
  return { original, modified }
}

// Same shape as getDiffContent above, but for a specific historical commit
// rather than the working tree: compares the file against its first parent.
// showRef already resolves to '' on any git error, so this needs no extra
// handling for the initial commit (no `^`) or a file the commit added.
export async function getCommitDiffContent(
  cwd: string,
  hash: string,
  path: string
): Promise<{ original: string; modified: string }> {
  const [original, modified] = await Promise.all([
    showRef(cwd, `${hash}^:${path}`),
    showRef(cwd, `${hash}:${path}`),
  ])
  return { original, modified }
}
