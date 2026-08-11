import type { FileNode, GitStatus, GitCommitResult, GitDiffContent, GitAheadBehind, GitCommandAction, GitCheckoutPayload, GitBranchList, GitCommit, GitBranchDiff, SearchMatch } from './index'
import type { BrowserViewEvent } from '../../electron/browserViews'
import type { InlineEditStartPayload, InlineEditEvent } from '../../electron/inlineEdit'
import type { LatestUsage } from '../../electron/usagePoller'
import type { UpdateInfo } from '../../electron/updateChecker'
import type { GraphifyGraph } from './graphify'
import type { DefinitionLocation, DetectResult, LspServerId } from '../../electron/lsp/types'

export type { LatestUsage, UpdateInfo }

export type AssistantKind = 'claude' | 'codex' | 'cosmos'

export interface SessionData {
  layout: unknown
  paneTabs: Record<string, string | null>
  paneTabLists: Record<string, string[]>
  activeTabPath: string | null
  activePaneId: string
  tabs: { path: string }[]
  browserUrls: Record<string, string>
}

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

export interface RecentProject {
  path: string
  lastOpened: number
}

export type CosmosEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'content-replace'; content: string }
  | { type: 'tool-call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'need-approval'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool-result'; id: string; result: string; isError: boolean }
  | { type: 'new-turn' }
  | { type: 'done' }
  | { type: 'error'; message: string }

declare global {
  interface Window {
    api: {
      readDir: (path: string) => Promise<FileNode[]>
      readFile: (path: string) => Promise<string>
      readImageDataUrl: (path: string) => Promise<string>
      pathExists: (path: string) => Promise<boolean>
      writeFile: (path: string, content: string) => Promise<void>
      mkdir: (path: string) => Promise<void>
      renamePath: (from: string, to: string) => Promise<void>
      trashPath: (path: string) => Promise<void>
      listAllFiles: (root: string) => Promise<string[]>
      searchText: (root: string, query: string, caseSensitive: boolean) => Promise<SearchMatch[]>
      openFolder: () => Promise<string | null>
      fsWatchRoot: (cwd: string | null) => void
      onFsChanged: (cb: (cwd: string) => void) => () => void

      gitBranch: (cwd: string) => Promise<string | null>
      gitAheadBehind: (cwd: string) => Promise<GitAheadBehind | null>
      gitStatus: (cwd: string) => Promise<GitStatus>
      gitListIgnored: (cwd: string) => Promise<string[]>
      gitStage: (cwd: string, paths: string[]) => Promise<void>
      gitUnstage: (cwd: string, paths: string[]) => Promise<void>
      gitStageAll: (cwd: string) => Promise<void>
      gitUnstageAll: (cwd: string) => Promise<void>
      gitDiscard: (cwd: string, path: string) => Promise<void>
      gitCommit: (cwd: string, message: string) => Promise<GitCommitResult>
      gitDiff: (cwd: string, path: string, staged: boolean) => Promise<GitDiffContent>
      gitCommitDiff: (cwd: string, hash: string, path: string) => Promise<GitDiffContent>
      gitRunCommand: (id: string, cwd: string, action: GitCommandAction, payload?: GitCheckoutPayload) => Promise<void>
      onGitLogData: (cb: (id: string, data: string) => void) => () => void
      onGitLogExit: (cb: (id: string, code: number) => void) => () => void
      gitGraph: (cwd: string) => Promise<GitCommit[]>
      gitBranches: (cwd: string) => Promise<string[]>
      gitDefaultBranch: (cwd: string) => Promise<string | null>
      gitBranchList: (cwd: string) => Promise<GitBranchList>
      gitBranchDiff: (cwd: string, source: string, target: string) => Promise<GitBranchDiff>
      gitShowStat: (cwd: string, hash: string) => Promise<string[]>
      gitWatchRoot: (cwd: string | null) => void
      onGitChanged: (cb: (cwd: string) => void) => () => void

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
      getInitialProject: () => Promise<string | null>
      onMenuCloseActiveTab: (cb: () => void) => () => void
      onMenuZoomIn: (cb: () => void) => () => void
      onMenuZoomOut: (cb: () => void) => () => void
      onMenuResetZoom: (cb: () => void) => () => void
      onMenuOpenSettings: (cb: () => void) => () => void
      onMenuNewFile: (cb: () => void) => () => void
      onMenuNewFolder: (cb: () => void) => () => void
      onMenuNewTerminal: (cb: () => void) => () => void
      onMenuReopenClosedTab: (cb: () => void) => () => void
      onMenuSave: (cb: () => void) => () => void
      onMenuFind: (cb: () => void) => () => void
      onMenuFindInFiles: (cb: () => void) => () => void
      onMenuToggleSidebar: (cb: () => void) => () => void
      onMenuCommandPalette: (cb: () => void) => () => void
      onMenuActionPalette: (cb: () => void) => () => void
      onMenuToggleClaudeChat: (cb: () => void) => () => void
      onMenuRecentProjectsPalette: (cb: () => void) => () => void
      openProjectInNewWindow: (path: string) => Promise<void>
      focusProjectIfOpen: (path: string) => Promise<boolean>

      mobileStart: () => Promise<void>
      mobileStop: () => Promise<void>
      mobileGetState: () => Promise<MobileState>
      mobileAddDevice: () => Promise<void>
      mobileSetDisplay: (theme: string, font: string) => void
      onMobileState: (cb: (state: MobileState) => void) => () => void

      usageAcquire: () => Promise<void>
      usageRelease: () => Promise<void>
      usageGetLatest: () => Promise<LatestUsage | null>
      usageGetPassiveEnabled: () => Promise<boolean>
      usageSetPassiveEnabled: (enabled: boolean) => Promise<void>
      onUsageUpdate: (cb: (latest: LatestUsage | null) => void) => () => void

      updateGetLatest: () => Promise<UpdateInfo | null>
      updateRestart: () => void
      onUpdateAvailable: (cb: (info: UpdateInfo | null) => void) => () => void
      onUpdateUpToDate: (cb: (version: string) => void) => () => void
      getChangelogForVersion: (version: string) => Promise<string | null>

      cosmosSend: (cwd: string, messages: CosmosMessage[], agentMode: boolean, settings: CosmosSettings) => void
      cosmosApprove: (toolCallId: string) => void
      cosmosReject: (toolCallId: string) => void
      cosmosCancel: () => void
      cosmosTestConnection: (settings: CosmosSettings) => Promise<{ ok: boolean; error?: string }>
      cosmosGetSettings: () => Promise<CosmosSettings | null>
      cosmosSetSettings: (settings: CosmosSettings) => Promise<void>
      onCosmosEvent: (cb: (event: CosmosEvent) => void) => () => void

      devtoolsAttach: (targetId: number, hostId: number) => Promise<void>
      devtoolsDetach: (targetId: number) => Promise<void>

      browserViewCreate: (id: string, url: string) => Promise<number | null>
      browserViewSetBounds: (id: string, bounds: { x: number; y: number; width: number; height: number }) => Promise<void>
      browserViewSetVisible: (id: string, visible: boolean) => Promise<void>
      browserViewNavigate: (id: string, url: string) => Promise<void>
      browserViewGoBack: (id: string) => Promise<void>
      browserViewGoForward: (id: string) => Promise<void>
      browserViewReload: (id: string) => Promise<void>
      browserViewZoomIn: (id: string) => Promise<void>
      browserViewZoomOut: (id: string) => Promise<void>
      browserViewZoomReset: (id: string) => Promise<void>
      browserViewDestroy: (id: string) => Promise<void>
      onBrowserViewEvent: (cb: (id: string, event: BrowserViewEvent) => void) => () => void

      sessionLoad: (projectRoot: string) => Promise<SessionData | null>
      sessionSave: (projectRoot: string, data: SessionData) => Promise<void>

      recentProjectsList: () => Promise<RecentProject[]>
      recentProjectsAdd: (path: string) => Promise<void>
      recentProjectsClear: () => Promise<void>

      setWindowTitle: (root: string) => void

      autocompleteComplete: (prefix: string, suffix: string, language: string, model: string) => Promise<string | null>

      inlineEditStart: (payload: InlineEditStartPayload) => void
      inlineEditCancel: () => void
      onInlineEditEvent: (cb: (event: InlineEditEvent) => void) => () => void

      graphifyIsAvailable: () => Promise<boolean>
      graphifyRun: (id: string, cwd: string) => Promise<void>
      graphifyReadGraph: (cwd: string) => Promise<GraphifyGraph>
      graphifyInstallClaudeSkill: (cwd: string) => Promise<{ ok: boolean; output: string }>
      onGraphifyData: (cb: (id: string, data: string) => void) => () => void
      onGraphifyExit: (cb: (id: string, code: number) => void) => () => void

      lspDetectAll: () => Promise<Record<LspServerId, DetectResult & { label: string; ramEstimate: string }>>
      lspInstall: (id: string) => Promise<void>
      lspSetEnabled: (id: string, enabled: boolean) => void
      lspGetDefinition: (params: {
        language: string
        projectRoot: string
        filePath: string
        content: string
        line: number
        column: number
      }) => Promise<DefinitionLocation[]>
      onLspInstallData: (cb: (id: string, chunk: string) => void) => () => void
      onLspInstallExit: (cb: (id: string, code: number) => void) => () => void
    }
  }
}

export {}
