import React from 'react'

export interface ActivityBarItem {
  id: string
  icon: React.ReactNode
  title: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}

interface ActivityBarProps {
  side: 'left' | 'right'
  groups: ActivityBarItem[][]
  bottomGroups?: ActivityBarItem[][]
  showAccent?: boolean
  dense?: boolean
}

function ActivityBarButton({ item, showAccent, side, dense }: { item: ActivityBarItem; showAccent: boolean; side: 'left' | 'right'; dense: boolean }) {
  return (
    <button
      key={item.id}
      onClick={item.disabled ? undefined : item.onClick}
      aria-label={item.title}
      disabled={item.disabled}
      className={[
        'relative flex items-center justify-center w-12 transition-colors group disabled:cursor-not-allowed',
        dense ? 'h-8' : 'h-12',
      ].join(' ')}
    >
      {showAccent && item.active && !item.disabled && (
        <span
          className={[
            'absolute top-1 bottom-1 w-0.5 bg-accent rounded',
            side === 'left' ? 'left-0 rounded-r' : 'right-0 rounded-l',
          ].join(' ')}
        />
      )}
      <span
        className={[
          'transition-opacity',
          item.disabled
            ? 'text-gray-600 opacity-30'
            : item.active
              ? 'text-white opacity-100'
              : 'text-gray-500 opacity-50 group-hover:opacity-80 group-hover:text-gray-300',
        ].join(' ')}
      >
        {item.icon}
      </span>
      <span
        className={[
          'pointer-events-none absolute z-50 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-xs text-gray-200 opacity-0 transition-opacity duration-100 delay-150 group-hover:opacity-100',
          side === 'left' ? 'left-full ml-2' : 'right-full mr-2',
        ].join(' ')}
      >
        {item.title}
      </span>
    </button>
  )
}

function Divider({ dense }: { dense: boolean }) {
  return <div className={['w-6 h-px bg-border shrink-0', dense ? 'my-0.5' : 'my-1'].join(' ')} />
}

function ItemGroups({ groups, side, showAccent, dense }: { groups: ActivityBarItem[][]; side: 'left' | 'right'; showAccent: boolean; dense: boolean }) {
  return (
    <>
      {groups.map((group, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Divider dense={dense} />}
          {group.map((item) => (
            <ActivityBarButton key={item.id} item={item} showAccent={showAccent} side={side} dense={dense} />
          ))}
        </React.Fragment>
      ))}
    </>
  )
}

export function ActivityBar({ side, groups, bottomGroups, showAccent = true, dense = false }: ActivityBarProps) {
  return (
    <div
      className={[
        'flex flex-col items-center w-12 shrink-0 bg-sidebar py-1',
        side === 'left' ? 'border-r border-border' : 'border-l border-border',
      ].join(' ')}
    >
      <ItemGroups groups={groups} side={side} showAccent={showAccent} dense={dense} />
      {bottomGroups && (
        <div className="flex flex-col items-center mt-auto">
          <ItemGroups groups={bottomGroups} side={side} showAccent={showAccent} dense={dense} />
        </div>
      )}
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

export function NewSessionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 3H6C4.9 3 4 3.9 4 5V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V9L14 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 3V9H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 12V17M9.5 14.5H14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function PreviousSessionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 12a9 9 0 1 0 3-6.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 4v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function CompactIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 9L12 13L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 15C6.5 17 17.5 17 20 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4 18.3C6.5 19.6 17.5 19.6 20 18.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4 21.5H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function ClearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 20H9L3.5 14.5C2.7 13.7 2.7 12.3 3.5 11.5L13 2L21.5 10.5L13.5 18.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.5 6.5L17 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function UsageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 20V12M12 20V4M20 20V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
