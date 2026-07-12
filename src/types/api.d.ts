import type { FileNode, GitStatus, GitCommitResult, GitDiffContent, GitAheadBehind, GitCommandAction, GitCommit, GitBranchDiff } from './index'

export type AssistantKind = 'claude' | 'codex'

declare global {
  interface Window {
    api: {
      readDir: (path: string) => Promise<FileNode[]>
      readFile: (path: string) => Promise<string>
      writeFile: (path: string, content: string) => Promise<void>
      mkdir: (path: string) => Promise<void>
      renamePath: (from: string, to: string) => Promise<void>
      trashPath: (path: string) => Promise<void>
      openFolder: () => Promise<string | null>

      gitBranch: (cwd: string) => Promise<string | null>
      gitAheadBehind: (cwd: string) => Promise<GitAheadBehind | null>
      gitStatus: (cwd: string) => Promise<GitStatus>
      gitStage: (cwd: string, paths: string[]) => Promise<void>
      gitUnstage: (cwd: string, paths: string[]) => Promise<void>
      gitStageAll: (cwd: string) => Promise<void>
      gitUnstageAll: (cwd: string) => Promise<void>
      gitCommit: (cwd: string, message: string) => Promise<GitCommitResult>
      gitDiff: (cwd: string, path: string, staged: boolean) => Promise<GitDiffContent>
      gitRunCommand: (id: string, cwd: string, action: GitCommandAction) => Promise<void>
      onGitLogData: (cb: (id: string, data: string) => void) => () => void
      onGitLogExit: (cb: (id: string, code: number) => void) => () => void
      gitGraph: (cwd: string) => Promise<GitCommit[]>
      gitBranches: (cwd: string) => Promise<string[]>
      gitBranchDiff: (cwd: string, source: string, target: string) => Promise<GitBranchDiff>
      gitShowStat: (cwd: string, hash: string) => Promise<string[]>

      termSpawn: () => Promise<void>
      termWrite: (data: string) => void
      termResize: (cols: number, rows: number) => void
      onTermData: (cb: (data: string) => void) => () => void

      assistantSpawn: (cwd: string, assistant: AssistantKind, mode?: 'new' | 'continue') => Promise<void>
      assistantWrite: (assistant: AssistantKind, data: string) => void
      assistantResize: (assistant: AssistantKind, cols: number, rows: number) => void
      onAssistantData: (cb: (assistant: AssistantKind, data: string) => void) => () => void

      onMenuOpenProject: (cb: () => void) => () => void
    }
  }
}

export {}
