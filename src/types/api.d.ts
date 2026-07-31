import type { FileNode, GitStatus, GitCommitResult, GitDiffContent, GitAheadBehind, GitCommandAction, GitCommit, GitBranchDiff, SearchMatch } from './index'

export type AssistantKind = 'claude' | 'codex' | 'cosmos'

export interface MobileState {
  running: boolean
  port: number
  localIp: string
  pin: string
  qrSvg: string
  connectedCount: number
  allowingNewDevice: boolean
}

export type CosmosRole = 'system' | 'user' | 'assistant' | 'tool'

export interface CosmosToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface CosmosMessage {
  role: CosmosRole
  content: string | null
  tool_calls?: CosmosToolCall[]
  tool_call_id?: string
}

export interface CosmosSettings {
  endpoint: string
  apiKey: string
  modelId: string
}

export type CosmosEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'content-replace'; content: string }
  | { type: 'tool-call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'need-approval'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool-result'; id: string; result: string; isError: boolean }
  | { type: 'done' }
  | { type: 'error'; message: string }

declare global {
  interface Window {
    api: {
      readDir: (path: string) => Promise<FileNode[]>
      readFile: (path: string) => Promise<string>
      pathExists: (path: string) => Promise<boolean>
      writeFile: (path: string, content: string) => Promise<void>
      mkdir: (path: string) => Promise<void>
      renamePath: (from: string, to: string) => Promise<void>
      trashPath: (path: string) => Promise<void>
      listAllFiles: (root: string) => Promise<string[]>
      searchText: (root: string, query: string, caseSensitive: boolean) => Promise<SearchMatch[]>
      openFolder: () => Promise<string | null>

      gitBranch: (cwd: string) => Promise<string | null>
      gitAheadBehind: (cwd: string) => Promise<GitAheadBehind | null>
      gitStatus: (cwd: string) => Promise<GitStatus>
      gitStage: (cwd: string, paths: string[]) => Promise<void>
      gitUnstage: (cwd: string, paths: string[]) => Promise<void>
      gitStageAll: (cwd: string) => Promise<void>
      gitUnstageAll: (cwd: string) => Promise<void>
      gitDiscard: (cwd: string, path: string) => Promise<void>
      gitCommit: (cwd: string, message: string) => Promise<GitCommitResult>
      gitDiff: (cwd: string, path: string, staged: boolean) => Promise<GitDiffContent>
      gitRunCommand: (id: string, cwd: string, action: GitCommandAction) => Promise<void>
      onGitLogData: (cb: (id: string, data: string) => void) => () => void
      onGitLogExit: (cb: (id: string, code: number) => void) => () => void
      gitGraph: (cwd: string) => Promise<GitCommit[]>
      gitBranches: (cwd: string) => Promise<string[]>
      gitBranchDiff: (cwd: string, source: string, target: string) => Promise<GitBranchDiff>
      gitShowStat: (cwd: string, hash: string) => Promise<string[]>

      termSpawn: (id: string, cwd?: string) => Promise<void>
      termKill: (id: string) => Promise<void>
      termWrite: (id: string, data: string) => void
      termResize: (id: string, cols: number, rows: number) => void
      onTermData: (cb: (id: string, data: string) => void) => () => void
      onTermExit: (cb: (id: string) => void) => () => void

      assistantSpawn: (cwd: string, assistant: AssistantKind, mode?: 'new' | 'continue') => Promise<void>
      assistantWrite: (assistant: AssistantKind, data: string) => void
      assistantResize: (assistant: AssistantKind, cols: number, rows: number) => void
      onAssistantData: (cb: (assistant: AssistantKind, data: string) => void) => () => void

      onMenuOpenProject: (cb: () => void) => () => void
      onMenuCloseActiveTab: (cb: () => void) => () => void

      mobileStart: () => Promise<void>
      mobileStop: () => Promise<void>
      mobileGetState: () => Promise<MobileState>
      mobileAddDevice: () => Promise<void>
      onMobileState: (cb: (state: MobileState) => void) => () => void

      cosmosSend: (cwd: string, messages: CosmosMessage[], agentMode: boolean, settings: CosmosSettings) => void
      cosmosApprove: (toolCallId: string) => void
      cosmosReject: (toolCallId: string) => void
      cosmosCancel: () => void
      cosmosTestConnection: (settings: CosmosSettings) => Promise<{ ok: boolean; error?: string }>
      onCosmosEvent: (cb: (event: CosmosEvent) => void) => () => void
    }
  }
}

export {}
