import type { ReactNode } from 'react'

export function ContextMenuButton({ children, danger = false, onClick }: {
  children: ReactNode
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded px-2 py-1.5 text-left text-xs transition-colors',
        danger
          ? 'text-red-300 hover:bg-red-500/15 hover:text-red-200'
          : 'text-fg-muted hover:bg-white/5 hover:text-fg',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function ContextMenuDivider() {
  return <div className="my-1 h-px bg-border" />
}
