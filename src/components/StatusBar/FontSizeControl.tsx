import { useEffect, useRef, useState } from 'react'
import { useFontSizeStore } from '@/stores/fontSizeStore'

// How long the chip stays highlighted after the size changes from outside
// its own popover (the View menu's ⌘+ / ⌘− / ⌘0).
const KEYBOARD_FLASH_MS = 1500

// The footer's font-size control (VIDE-140): a compact chip — screen icon +
// size — that opens the original − 13 + pill just above it. Saves footer
// width for the clock while keeping the pill exactly as it was.
export function FontSizeControl() {
  const { fontSize, increase, decrease, reset } = useFontSizeStore()
  const [open, setOpen] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const prevSize = useRef(fontSize)
  useEffect(() => {
    if (prevSize.current === fontSize) return
    prevSize.current = fontSize
    // Changes made from the open pill are already in view.
    if (open) return
    setFlashing(true)
    const timer = setTimeout(() => setFlashing(false), KEYBOARD_FLASH_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative flex">
      <button
        type="button"
        data-testid="font-size-chip"
        onClick={() => setOpen((o) => !o)}
        aria-label="Font size"
        aria-expanded={open}
        title="Font size"
        className={[
          'flex h-5 shrink-0 items-center gap-1 rounded-full border bg-bg px-2 text-xs tabular-nums transition-colors',
          flashing
            ? 'border-accent text-accent'
            : open
              ? 'border-fg-subtle text-fg'
              : 'border-border text-fg-muted hover:text-fg hover:border-fg-subtle',
        ].join(' ')}
      >
        <ScreenIcon />
        <span>{fontSize}</span>
      </button>
      {open && (
        <div
          data-testid="font-size-popover"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 flex items-center rounded-full border border-border bg-bg overflow-hidden shadow-lg shadow-black/40"
        >
          <button
            type="button"
            onClick={decrease}
            aria-label="Decrease font size"
            className="flex h-5 w-6 items-center justify-center text-fg-muted hover:text-fg hover:bg-white/5"
          >
            <MinusIcon />
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="Reset font size"
            title="Reset font size"
            className="flex h-5 min-w-[1.75rem] items-center justify-center border-x border-border px-1 text-xs tabular-nums text-fg-muted hover:text-fg hover:bg-white/5"
          >
            {fontSize}
          </button>
          <button
            type="button"
            onClick={increase}
            aria-label="Increase font size"
            className="flex h-5 w-6 items-center justify-center text-fg-muted hover:text-fg hover:bg-white/5"
          >
            <PlusIcon />
          </button>
        </div>
      )}
    </div>
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

// Same pill styling/icons as the browser zoom control (BrowserTab.tsx) —
// duplicated locally since those icons aren't exported from there.
function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
