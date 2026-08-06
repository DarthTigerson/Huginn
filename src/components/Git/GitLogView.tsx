import { useEffect, useRef } from 'react'
import { useGitLogStore } from '@/stores/gitLogStore'
import { useThemeStore, XTERM_THEMES } from '@/stores/themeStore'
import { useDisplayStore } from '@/stores/displayStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'

export function GitLogView() {
  const text = useGitLogStore((s) => s.text)
  const theme = useThemeStore((s) => s.theme)
  const font = useDisplayStore((s) => s.font)
  const fontSize = useFontSizeStore((s) => s.fontSize)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [text])

  // Reuse the same per-theme palette the real terminal (TerminalTab.tsx) is
  // themed with — a hardcoded claude/codex-only dark check here used to leave
  // this looking unthemed (wrong-colored background) for every other theme,
  // including both thomas variants.
  const xtermTheme = XTERM_THEMES[theme]

  return (
    <div
      className="h-full overflow-auto p-4"
      style={{
        background: xtermTheme.background,
        color: xtermTheme.foreground,
        fontFamily: font,
        fontSize,
      }}
    >
      <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed m-0">
        {text || 'No git commands run yet.'}
      </pre>
      <div ref={bottomRef} />
    </div>
  )
}
