import { useEditorSettingsStore } from '@/stores/editorSettingsStore'
import { useGitReposStore } from '@/stores/gitReposStore'

// Footer switch for the editor's inline diff highlight (line wash + changed
// words). Same setting as Settings > Git, the palette's Show/Hide command
// and the tab menu's entry. Hidden when the project has no git repo, since
// there's nothing to diff against.
export function InlineDiffToggle() {
  const enabled = useEditorSettingsStore((s) => s.inlineDiffEnabled)
  const hasRepo = useGitReposStore((s) => s.repos.length > 0)
  if (!hasRepo) return null

  return (
    <button
      type="button"
      onClick={() => useEditorSettingsStore.getState().toggleInlineDiff()}
      aria-label={enabled ? 'Inline diff highlight on' : 'Inline diff highlight off'}
      aria-pressed={enabled}
      title={enabled ? 'Inline diff: on' : 'Inline diff: off'}
      className={[
        'h-5 px-1 flex items-center justify-center transition-colors',
        enabled ? 'text-fg-muted hover:text-fg' : 'text-fg-subtle hover:text-fg-muted',
      ].join(' ')}
    >
      <InlineDiffIcon crossedOut={!enabled} />
    </button>
  )
}

// Three text lines, the middle one carrying a highlighted word - the same
// picture the feature paints in the editor.
function InlineDiffIcon({ crossedOut }: { crossedOut: boolean }) {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">
      <path d="M2 3h12M2 11h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 7h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="6.5" y="5" width="7.5" height="4" rx="1" fill="currentColor" opacity="0.55" />
      {crossedOut && <path d="M1 13L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  )
}
