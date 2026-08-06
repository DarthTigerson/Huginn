export interface ShortcutEntry {
  keys: string[]
  label: string
}

export interface ShortcutGroup {
  category: string
  items: ShortcutEntry[]
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: 'Navigation',
    items: [
      { keys: ['⌘', 'B'], label: 'Toggle Sidebar' },
      { keys: ['⌘', 'P'], label: 'Command Palette' },
      { keys: ['⌘', '⇧', 'P'], label: 'Action Palette' },
      { keys: ['⌘', 'F'], label: 'Search' },
      { keys: ['⌘', 'T'], label: 'New Terminal' },
      { keys: ['⌘', 'L'], label: 'Toggle Chat Panel' },
      { keys: ['⇧', '⇥'], label: 'Toggle Cosmos Agent Mode' },
    ],
  },
  {
    category: 'Editor',
    items: [
      { keys: ['⌘', 'S'], label: 'Save' },
      { keys: ['⌘', 'D'], label: 'Split Pane Horizontal' },
      { keys: ['⌘', '⇧', 'D'], label: 'Split Pane Vertical' },
    ],
  },
  {
    category: 'Project',
    items: [
      { keys: ['⌘', 'W'], label: 'Close Tab' },
      { keys: ['⌘', '⇧', 'T'], label: 'Reopen Closed Tab' },
      { keys: ['⌘', '⇧', 'O'], label: 'Open Project' },
    ],
  },
  {
    category: 'Display',
    items: [
      { keys: ['⌘', '+'], label: 'Zoom In (Focused Editor/Terminal)' },
      { keys: ['⌘', '-'], label: 'Zoom Out (Focused Editor/Terminal)' },
      { keys: ['⌘', '0'], label: 'Reset Zoom (Focused Editor/Terminal)' },
      { keys: ['⌘', '⇧', '+'], label: 'Zoom In (Global)' },
      { keys: ['⌘', '⇧', '-'], label: 'Zoom Out (Global)' },
      { keys: ['⌘', '⇧', '0'], label: 'Reset Zoom (Global)' },
    ],
  },
]
