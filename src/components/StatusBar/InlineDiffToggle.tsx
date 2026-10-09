import { useEditorSettingsStore } from '@/stores/editorSettingsStore'
import { useGitReposStore } from '@/stores/gitReposStore'
import { FooterTooltip } from './FooterTooltip'

// Footer switch for the editor's inline diff highlight (line wash + changed
// words). Same setting as Settings > Git, the palette's Show/Hide command
// and the tab menu's entry. Hidden when turned off in Settings > Git, or when
// the project has no git repo, since there's nothing to diff against.
export function InlineDiffToggle() {
  const enabled = useEditorSettingsStore((s) => s.inlineDiffEnabled)
  const showIcon = useEditorSettingsStore((s) => s.inlineDiffFooterIcon)
  const hasRepo = useGitReposStore((s) => s.repos.length > 0)
  if (!showIcon || !hasRepo) return null

  return (
    <FooterTooltip label={enabled ? 'Inline diff: on' : 'Inline diff: off'}>
      <button
        type="button"
        onClick={() => useEditorSettingsStore.getState().toggleInlineDiff()}
        aria-label={enabled ? 'Inline diff highlight on' : 'Inline diff highlight off'}
        aria-pressed={enabled}
        className={[
          // Same rounded/bordered pill as the sync button, font-size chip and bell beside it.
          'flex items-center justify-center h-5 w-5 shrink-0 rounded-full border bg-bg transition-colors',
          enabled
            ? 'border-border text-fg-muted hover:text-fg hover:border-fg-subtle'
            : 'border-border text-fg-subtle hover:text-fg-muted hover:border-fg-subtle',
        ].join(' ')}
      >
        <InlineDiffIcon crossedOut={!enabled} />
      </button>
    </FooterTooltip>
  )
}

// Highlighter pen, adapted from Lucide's "highlighter" (ISC). The off-state
// slash runs top-left to bottom-right, like the autocomplete icon's, so it
// crosses the pen's diagonal instead of running alongside it.
export function InlineDiffIcon({ crossedOut }: { crossedOut: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="m9 11-6 6v3h9l3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {crossedOut && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  )
}
