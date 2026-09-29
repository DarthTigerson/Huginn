import { useFooterBlameStore } from '@/stores/footerBlameStore'

// Current-line git blame in the footer (Settings > Git > Blame: Footer), next
// to the branch. Inline it's just author + message (the message truncates to
// fit); hovering opens a panel with the author, exact date/time and the full
// commit message, styled like TodoTrashPage's hover labels.
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
      {blame.kind === 'commit' && (
        <div
          role="tooltip"
          aria-label="Blame details"
          className="pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 w-max max-w-md rounded bg-black/90 px-3 py-2 text-xs text-gray-200 opacity-0 transition-opacity duration-100 delay-150 group-hover:opacity-100"
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-gray-400">Author</dt>
            <dd>{blame.author}</dd>
            <dt className="text-gray-400">Date</dt>
            <dd className="tabular-nums">
              {blame.date} <span className="text-gray-400">({blame.relDate})</span>
            </dd>
            <dt className="text-gray-400">Message</dt>
            <dd className="whitespace-pre-wrap break-words">{blame.summary}</dd>
          </dl>
        </div>
      )}
    </span>
  )
}
