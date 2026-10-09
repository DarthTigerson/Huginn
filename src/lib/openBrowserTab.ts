import { useEditorStore } from '@/stores/editorStore'
import { buildBrowserPath } from '@/components/Settings/paths'

// Shared by App's "new browser" button and the action palette. Deliberately
// does not touch the left panel: App layers its own closeSidePanelOnOpen
// handling on top because that state lives in App.
export function openNewBrowserTab(): void {
  const id = Date.now().toString(36)
  useEditorStore.getState().openTab({ path: buildBrowserPath(id), content: '', dirty: false })
}
