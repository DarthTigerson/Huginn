import { useEditorStore } from '@/stores/editorStore'

// Shared by lspClient.ts (cross-file go-to-definition) and the Claude
// terminal's clickable file paths — both need "open this absolute path,
// reusing an already-open tab if there is one, then jump to a location."
// searchTerm sets how much text the editor highlights at the location (it
// selects col .. col + searchTerm.length); search results pass the matched text.
// stayInActivePane keeps the file in the window you're working in instead of
// following Settings > General > "Open new tabs in" - go-to-definition uses
// it, since jumping to a definition in another window is disorienting.
export async function openFileAtLocation(
  path: string,
  line?: number,
  col?: number,
  searchTerm = '',
  { stayInActivePane = false }: { stayInActivePane?: boolean } = {},
): Promise<void> {
  const { tabs } = useEditorStore.getState()
  const existingTab = tabs.find((t) => t.path === path)
  const tab = existingTab
    ? { path: existingTab.path, content: existingTab.content, dirty: existingTab.dirty }
    : { path, content: await window.api.readFile(path), dirty: false }
  const editor = useEditorStore.getState()
  if (stayInActivePane) editor.openTabInPane(tab, editor.activePaneId)
  else editor.openTab(tab)
  if (line !== undefined) {
    useEditorStore.getState().setRevealRequest({ path, line, col: col ?? 1, searchTerm })
  }
}
