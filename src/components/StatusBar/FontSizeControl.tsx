import { useEffect, useRef, useState } from 'react'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useEditorStore } from '@/stores/editorStore'
import { DISPLAY_TAB_PATH } from '@/components/Settings/paths'

// How long the chip stays highlighted after the size changes (the View
// menu's ⌘+ / ⌘− / ⌘0, or anywhere else).
const CHANGE_FLASH_MS = 1500

// The footer's font-size indicator (VIDE-140): a compact chip — screen icon
// + size — that opens Settings > Display. Size itself is changed with the
// existing ⌘+ / ⌘− / ⌘0 menu shortcuts; the chip lights up briefly when it
// does so the new number is noticed.
export function FontSizeControl() {
  const fontSize = useFontSizeStore((s) => s.fontSize)
  const [flashing, setFlashing] = useState(false)

  const prevSize = useRef(fontSize)
  useEffect(() => {
    if (prevSize.current === fontSize) return
    prevSize.current = fontSize
    setFlashing(true)
    const timer = setTimeout(() => setFlashing(false), CHANGE_FLASH_MS)
    return () => clearTimeout(timer)
  }, [fontSize])

  return (
    <button
      type="button"
      data-testid="font-size-chip"
      onClick={() => useEditorStore.getState().openTab({ path: DISPLAY_TAB_PATH, content: '', dirty: false })}
      aria-label={`Font size ${fontSize}, open Display settings`}
      title="Display settings"
      className={[
        'flex h-5 shrink-0 items-center gap-1 rounded-full border bg-bg px-2 text-xs tabular-nums transition-colors',
        flashing ? 'border-accent text-accent' : 'border-border text-fg-muted hover:text-fg hover:border-fg-subtle',
      ].join(' ')}
    >
      <ScreenIcon />
      <span>{fontSize}</span>
    </button>
  )
}

function ScreenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M9 20h6M12 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
