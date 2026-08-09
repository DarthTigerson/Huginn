const TERMINAL_PREFIX = 'terminal://'
export function isTerminalTab(path: string): boolean { return path.startsWith(TERMINAL_PREFIX) }
export function buildTerminalPath(id: string): string { return TERMINAL_PREFIX + id }
export function getTerminalId(path: string): string { return path.slice(TERMINAL_PREFIX.length) }

const BROWSER_PREFIX = 'browser://'
export function isBrowserTab(path: string): boolean { return path.startsWith(BROWSER_PREFIX) }
export function buildBrowserPath(id: string): string { return BROWSER_PREFIX + id }
export function getBrowserId(path: string): string { return path.slice(BROWSER_PREFIX.length) }

export const DISPLAY_TAB_PATH = 'settings://Display'
export const EDITOR_SETTINGS_TAB_PATH = 'settings://Editor'
export const GIT_SETTINGS_TAB_PATH = 'settings://Git'
export const BROWSER_SETTINGS_TAB_PATH = 'settings://Browser'
export const MODELS_SETTINGS_TAB_PATH = 'settings://Models'
export const GIT_LOG_TAB_PATH = 'git-log://Git Log'

export function isSettingsTab(path: string): boolean {
  return path.startsWith('settings://')
}

export function isGitLogTab(path: string): boolean {
  return path === GIT_LOG_TAB_PATH
}

export const GIT_GRAPH_TAB_PATH = 'git-graph://Graph'

export function isGitGraphTab(path: string): boolean {
  return path === GIT_GRAPH_TAB_PATH
}

export const GIT_BRANCH_DIFF_TAB_PATH = 'git-branch-diff://Branch Diff'

export function isGitBranchDiffTab(path: string): boolean {
  return path === GIT_BRANCH_DIFF_TAB_PATH
}

export const GRAPHIFY_GRAPH_TAB_PATH = 'graphify-graph://Graph'

export function isGraphifyGraphTab(path: string): boolean {
  return path === GRAPHIFY_GRAPH_TAB_PATH
}
