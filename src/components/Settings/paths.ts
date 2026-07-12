export const THEMES_TAB_PATH = 'settings://Themes'
export const DISPLAY_TAB_PATH = 'settings://Display'

export function isSettingsTab(path: string): boolean {
  return path.startsWith('settings://')
}
