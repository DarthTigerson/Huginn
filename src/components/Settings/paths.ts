export const DISPLAY_TAB_PATH = 'settings://Display'
export const GIT_SETTINGS_TAB_PATH = 'settings://Git'
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
