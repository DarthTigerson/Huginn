export function MobileDisplayPanel() {
  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="h-9 px-3 border-b border-border shrink-0 flex items-center">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Mobile Display
        </span>
      </div>
      <div className="flex-1" />
    </div>
  )
}
