import { useEditorCursorStore } from '@/stores/editorCursorStore'
import { useEditorStore } from '@/stores/editorStore'

// "Ln 42, Col 8 · TypeScript" for the active editor (VIDE-140). Hidden
// whenever the active tab isn't the editor that last published — settings
// pages, graphs, the usage tab, etc. have no cursor to show.
export function FooterCursor() {
  const cursor = useEditorCursorStore((s) => s.cursor)
  const activeTabPath = useEditorStore((s) => s.activeTabPath)
  if (!cursor || cursor.path !== activeTabPath) return null

  return (
    <span data-testid="footer-cursor" className="shrink-0 mr-2 text-xs text-fg-muted tabular-nums select-none whitespace-nowrap">
      Ln {cursor.line}, Col {cursor.column}
      <span className="text-fg-subtle"> · </span>
      {cursor.language}
    </span>
  )
}
