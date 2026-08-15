import type * as Monaco from 'monaco-editor'

// Tracks whichever Monaco editor instance was last focused, across the whole
// app - not "currently focused", since by the time something wants to read
// this (e.g. the Action Palette merging in editor commands) focus has
// usually already moved to that thing's own input, so hasTextFocus() would
// be false on every editor. Set on onDidFocusEditorWidget, cleared on
// onDidDispose so a switched-away-from tab's editor isn't held onto.
let current: Monaco.editor.IStandaloneCodeEditor | null = null

export function setLastFocusedEditor(editor: Monaco.editor.IStandaloneCodeEditor | null): void {
  current = editor
}

export function getLastFocusedEditor(): Monaco.editor.IStandaloneCodeEditor | null {
  return current
}
