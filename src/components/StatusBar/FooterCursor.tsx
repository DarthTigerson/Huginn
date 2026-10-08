import { useEditorCursorStore } from '@/stores/editorCursorStore'
import { useEditorStore } from '@/stores/editorStore'

// "Ln 42, Col 8" for the active editor (VIDE-140). Hidden
// whenever the active tab isn't the editor that last published — settings
// pages, graphs, the usage tab, etc. have no cursor to show.
export function FooterCursor() {
  const cursor = useEditorCursorStore((s) => s.cursor)
  const activeTabPath = useEditorStore((s) => s.activeTabPath)
  if (!cursor || cursor.path !== activeTabPath) return null

  return (
    // Divider matches FooterBlame's, separating the position from the
    // footer's controls (sync, font size, bell).
    <span className="flex items-center gap-3 shrink-0 mr-2">
      <span data-testid="footer-cursor" className="text-xs text-fg-muted tabular-nums select-none whitespace-nowrap">
        Ln {cursor.line}, Col {cursor.column}
      </span>
      <span className="w-px h-3 bg-border shrink-0" />
    </span>
  )
}
