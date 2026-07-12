export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export interface Tab {
  path: string
  content: string
  dirty: boolean
}

export interface GitFileEntry {
  path: string
  status: 'M' | 'A' | 'D' | 'R' | '?'
}

export interface GitStatus {
  staged: GitFileEntry[]
  unstaged: GitFileEntry[]
}

export type GitCommitResult = { ok: true } | { ok: false; error: string }

export interface GitDiffContent {
  original: string
  modified: string
}

export interface GitAheadBehind {
  ahead: number
  behind: number
}

export type GitCommandAction = 'fetch' | 'pull' | 'push' | 'forcePush' | 'forcePushLease'

export interface GitCommit {
  hash: string
  parents: string[]
  subject: string
  author: string
  date: string
  refs: string[]
}
