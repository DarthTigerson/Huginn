import React from 'react'

export interface ActivityBarItem {
  id: string
  icon: React.ReactNode
  title: string
  active: boolean
  onClick: () => void
}

interface ActivityBarProps {
  side: 'left' | 'right'
  items: ActivityBarItem[]
  showAccent?: boolean
}

export function ActivityBar({ side, items, showAccent = true }: ActivityBarProps) {
  return (
    <div
      className={[
        'flex flex-col items-center w-12 shrink-0 bg-sidebar py-1',
        side === 'left' ? 'border-r border-border' : 'border-l border-border',
      ].join(' ')}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick}
          title={item.title}
          className="relative flex items-center justify-center w-12 h-12 transition-colors group"
        >
          {showAccent && item.active && (
            <span
              className={[
                'absolute top-2 bottom-2 w-0.5 bg-accent rounded',
                side === 'left' ? 'left-0 rounded-r' : 'right-0 rounded-l',
              ].join(' ')}
            />
          )}
          <span className={[
            'transition-opacity',
            item.active ? 'text-white opacity-100' : 'text-gray-500 opacity-50 group-hover:opacity-80 group-hover:text-gray-300',
          ].join(' ')}>
            {item.icon}
          </span>
        </button>
      ))}
    </div>
  )
}

export function FilesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5C3 3.9 3.9 3 5 3H10.17C10.7 3 11.21 3.21 11.59 3.59L12.41 4.41C12.79 4.79 13.3 5 13.83 5H19C20.1 5 21 5.9 21 7V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 9H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function ClaudeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        clipRule="evenodd"
        fillRule="evenodd"
        d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"
        fill="#D97757"
      />
    </svg>
  )
}
