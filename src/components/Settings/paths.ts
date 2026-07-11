export const THEMES_TAB_PATH = 'settings://Themes'

export function isSettingsTab(path: string): boolean {
  return path.startsWith('settings://')
}
