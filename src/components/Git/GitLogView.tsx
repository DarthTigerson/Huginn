import { useEffect, useRef } from 'react'
import { useGitLogStore } from '@/stores/gitLogStore'
import { useThemeStore } from '@/stores/themeStore'
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

  const isDark = theme === 'claude-dark' || theme === 'codex-dark'

  return (
    <div
      className="h-full overflow-auto p-4"
      style={{
        background: isDark ? '#1a1a1a' : '#ffffff',
        color: isDark ? '#d4d4d4' : '#1f1f1f',
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
