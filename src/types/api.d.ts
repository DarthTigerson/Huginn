import type { FileNode, GitStatus, GitCommitResult, GitDiffContent } from './index'

export type AssistantKind = 'claude' | 'codex'

declare global {
  interface Window {
    api: {
      readDir: (path: string) => Promise<FileNode[]>
      readFile: (path: string) => Promise<string>
      writeFile: (path: string, content: string) => Promise<void>
      openFolder: () => Promise<string | null>

      gitBranch: (cwd: string) => Promise<string | null>
      gitStatus: (cwd: string) => Promise<GitStatus>
      gitStage: (cwd: string, paths: string[]) => Promise<void>
      gitUnstage: (cwd: string, paths: string[]) => Promise<void>
      gitStageAll: (cwd: string) => Promise<void>
      gitUnstageAll: (cwd: string) => Promise<void>
      gitCommit: (cwd: string, message: string) => Promise<GitCommitResult>
      gitDiff: (cwd: string, path: string, staged: boolean) => Promise<GitDiffContent>

      termSpawn: () => Promise<void>
      termWrite: (data: string) => void
      termResize: (cols: number, rows: number) => void
      onTermData: (cb: (data: string) => void) => () => void

      assistantSpawn: (cwd: string, assistant: AssistantKind, mode?: 'new' | 'continue') => Promise<void>
      assistantWrite: (assistant: AssistantKind, data: string) => void
      assistantResize: (assistant: AssistantKind, cols: number, rows: number) => void
      onAssistantData: (cb: (assistant: AssistantKind, data: string) => void) => () => void
    }
  }
}

export {}
