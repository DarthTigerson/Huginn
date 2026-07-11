export function GitPanel() {
  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Source Control
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-fg-subtle">No changes</p>
      </div>
    </div>
  )
}
