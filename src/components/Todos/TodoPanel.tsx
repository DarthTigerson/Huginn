export function TodoPanel() {
  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="h-9 px-3 border-b border-border shrink-0 flex items-center">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          To Do
        </span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-sm font-medium text-fg-muted">Coming Soon</p>
        <p className="text-xs text-fg-subtle">Task tracking isn't wired up yet.</p>
      </div>
    </div>
  )
}
