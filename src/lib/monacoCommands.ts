import { getLastFocusedEditor } from './lastFocusedEditor'
import type { Command } from '@/components/Search/commands'

// Monaco's own quick-command list (F1 in the editor) is what this replaces
// in the Action Palette - including it here would just be circular.
const EXCLUDED_IDS = new Set(['editor.action.quickCommand'])

// _standaloneKeybindingService isn't part of Monaco's public editor.api.d.ts
// surface - there's no documented way to resolve an arbitrary action id to
// its bound keybinding's display label otherwise (getSupportedActions()
// only gives id/label/run, not the keybinding). Kept strictly best-effort:
// any failure here (missing property, future Monaco version renaming it)
// just means no shortcut hint shown, never a broken command.
function lookupShortcut(editor: unknown, actionId: string): string | undefined {
  try {
    const service = (editor as { _standaloneKeybindingService?: { lookupKeybinding: (id: string) => { getLabel(): string | null } | undefined } })._standaloneKeybindingService
    return service?.lookupKeybinding(actionId)?.getLabel() ?? undefined
  } catch {
    return undefined
  }
}

// Merges the currently-relevant editor's own commands (Add Cursor Above,
// Format Document, etc.) into the Action Palette, so ⌘⇧P covers editor
// actions too instead of needing Monaco's separate, editor-only F1 list.
export function getMonacoCommands(): Command[] {
  const editor = getLastFocusedEditor()
  if (!editor) return []

  return editor.getSupportedActions()
    .filter((action) => {
      if (!action.label) return false
      if (action.label.startsWith('Developer:')) return false
      if (EXCLUDED_IDS.has(action.id)) return false
      if (!action.isSupported()) return false
      return true
    })
    .map((action) => ({
      id: `monaco:${action.id}`,
      label: `Editor: ${action.label}`,
      shortcut: lookupShortcut(editor, action.id),
      action: () => { action.run() },
    }))
}
