import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { useGitLogStore } from '@/stores/gitLogStore'
import { useThemeStore, XTERM_THEMES } from '@/stores/themeStore'
import { useDisplayStore } from '@/stores/displayStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useInstanceFontSizeStore } from '@/stores/instanceFontSizeStore'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'
import { GIT_LOG_TAB_PATH } from '@/components/Settings/paths'

export function GitLogView() {
  const text = useGitLogStore((s) => s.text)
  const theme = useThemeStore((s) => s.theme)
  const font = useDisplayStore((s) => s.font)
  const fontSize = useFontSizeStore((s) => s.fontSize)
  const fontSizeOverride = useInstanceFontSizeStore((s) => s.overrides[GIT_LOG_TAB_PATH])
  const effectiveFontSize = fontSizeOverride ?? fontSize
  const wordWrapEnabled = useEditorSettingsStore((s) => s.wordWrapEnabled)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Unshifted CmdOrCtrl+=/-/0 zoom just this panel, mirroring TerminalTab.tsx
  // and the Monaco editor commands — shifted variants are left unhandled so
  // they pass through to the app-level global zoom shortcut. Alt+Z mirrors
  // the same word-wrap toggle the Monaco editor binds, for consistency
  // across every "look at some text" surface in the app.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey && !event.metaKey && !event.ctrlKey && event.code === 'KeyZ') {
      event.preventDefault()
      useEditorSettingsStore.getState().toggleWordWrap()
      return
    }

    const isMod = event.metaKey || event.ctrlKey
    if (!isMod || event.shiftKey || event.altKey) return

    if (event.key === '=' || event.key === '+') {
      event.preventDefault()
      useInstanceFontSizeStore.getState().increase(GIT_LOG_TAB_PATH)
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      useInstanceFontSizeStore.getState().decrease(GIT_LOG_TAB_PATH)
    } else if (event.key === '0') {
      event.preventDefault()
      useInstanceFontSizeStore.getState().reset(GIT_LOG_TAB_PATH)
    }
  }

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
      className="h-full overflow-auto p-4 focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        background: xtermTheme.background,
        color: xtermTheme.foreground,
        fontFamily: font,
        fontSize: effectiveFontSize,
      }}
    >
      {/* fontSize can't just live on the wrapping div — Tailwind's `text-sm`
          hardcodes a font-size on <pre> itself, which shadows inheritance
          from any ancestor, so the zoom state changed but nothing visible
          moved. Setting it inline here bypasses that. */}
      <pre
        className={[
          'leading-relaxed m-0',
          wordWrapEnabled ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
        ].join(' ')}
        style={{ fontSize: effectiveFontSize }}
      >
        {text || 'No git commands run yet.'}
      </pre>
      <div ref={bottomRef} />
    </div>
  )
}
