import { toRelativePath } from '@/lib/sendSelectionToAssistant'
import { FileIcon, FolderIcon } from '@/components/Sidebar/FileIcon'

interface Props {
  path: string
  projectRoot: string | null
}

function ChevronIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" className="shrink-0 text-fg-subtle">
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function EditorBreadcrumb({ path, projectRoot }: Props) {
  const segments = toRelativePath(path, projectRoot).split('/').filter(Boolean)
  const lastIndex = segments.length - 1

  return (
    <div
      className="flex items-center gap-1 h-6 px-3 text-[0.6875rem] bg-panel shrink-0 overflow-x-auto whitespace-nowrap select-none"
    >
      {segments.map((segment, i) => {
        const isLast = i === lastIndex
        return (
          <span key={i} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronIcon />}
            {isLast ? <FileIcon name={segment} scale={0.75} /> : <FolderIcon open={false} scale={0.75} />}
            <span className={isLast ? 'text-fg font-medium' : 'text-fg-subtle'}>{segment}</span>
          </span>
        )
      })}
    </div>
  )
}
