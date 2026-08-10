import ReactMarkdown from 'react-markdown'
import { useChangelogStore } from '@/stores/changelogStore'
import { COMPACT_PROSE_CLASSES } from '@/components/Viewer/proseClasses'

export function UpdateChangelogModal() {
  const content = useChangelogStore((s) => s.content)
  const dismiss = useChangelogStore((s) => s.dismiss)

  if (!content) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div className="w-[480px] max-h-[70vh] flex flex-col bg-popover border border-border rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            What's New
          </span>
          <button
            type="button"
            onClick={dismiss}
            className="text-fg-subtle hover:text-fg transition-colors text-xs leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          <div className={COMPACT_PROSE_CLASSES}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
