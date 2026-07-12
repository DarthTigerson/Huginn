const pillButtonClass =
  'group w-full h-7 rounded-full flex items-center justify-center text-[10px] font-bold tracking-tight bg-gradient-to-br from-accent/25 to-accent/5 text-accent ring-1 ring-accent/30 shadow-sm shadow-black/20 transition-all duration-150 hover:ring-accent/60 hover:from-accent/35 hover:to-accent/10 hover:scale-105 active:scale-95'

export function GitPanel() {
  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Git Panel
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-fg-subtle">No changes</p>
      </div>
      <div className="border-t border-border shrink-0 px-3 py-2 flex flex-col gap-1.5">
        <button type="button" className={pillButtonClass} aria-label="Graph (not yet implemented)">
          Graph
        </button>
        <button type="button" className={pillButtonClass} aria-label="List Diff (not yet implemented)">
          List Diff
        </button>
        <button type="button" className={pillButtonClass} aria-label="GG (not yet implemented)">
          GG
        </button>
      </div>
    </div>
  )
}
