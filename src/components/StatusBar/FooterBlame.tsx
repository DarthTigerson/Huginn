import { useFooterBlameStore } from '@/stores/footerBlameStore'
import { BlameDetailsPanel } from '@/components/Git/BlameDetailsPanel'

// Current-line git blame in the footer (Settings > Git > Blame: Footer), next
// to the branch. Inline it's just author + message (the message truncates to
// fit); hovering opens BlameDetailsPanel with the author, exact date/time and
// the full commit message.
export function FooterBlame({ showDivider }: { showDivider: boolean }) {
  const blame = useFooterBlameStore((s) => s.blame)
  if (!blame) return null

  return (
    // Shrinks before the branch does. The inner span clips to nothing (divider
    // included) when there's no room; the panel sits outside it so it isn't clipped.
    <span className="group relative flex min-w-0 shrink-[9999]">
      <span className="flex items-center gap-3 min-w-0 overflow-hidden">
        {showDivider && <span className="w-px h-3 bg-border shrink-0" />}
        <span data-testid="footer-blame" className="truncate min-w-0 text-xs text-accent/70 cursor-default">
          {blame.kind === 'commit' ? (
            <>
              <span className="text-accent">{blame.author}</span>
              {` • ${blame.summary}`}
            </>
          ) : (
            'Uncommitted change'
          )}
        </span>
      </span>
      {blame.kind === 'commit' && <BlameDetailsPanel {...blame} placement="above" />}
    </span>
  )
}
