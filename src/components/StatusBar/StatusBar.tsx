import { useEffect, useRef, useState } from 'react'
import { useFontSizeStore } from '@/stores/fontSizeStore'

export function StatusBar() {
  const { fontSize, increase, decrease, reset } = useFontSizeStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuOpen])

  return (
    <div className="h-6 shrink-0 flex items-center justify-end px-3 bg-tab-bar border-t border-border select-none">
      <div className="flex items-center gap-1 text-fg-muted text-xs">
        <button
          type="button"
          onClick={decrease}
          className="w-5 h-5 flex items-center justify-center hover:text-fg transition-colors"
          aria-label="Decrease font size"
        >
          −
        </button>
        <div className="relative" ref={menuRef}>
          <span
            className="tabular-nums w-6 text-center cursor-default block"
            onContextMenu={(e) => { e.preventDefault(); setMenuOpen((o) => !o) }}
          >
            {fontSize}
          </span>
          {menuOpen && (
            <div className="absolute bottom-full right-0 mb-1 w-36 rounded border border-border bg-sidebar shadow-lg shadow-black/40 py-1 z-50">
              <button
                type="button"
                onClick={() => { reset(); setMenuOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-fg hover:bg-white/5 transition-colors"
              >
                Reset zoom
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={increase}
          className="w-5 h-5 flex items-center justify-center hover:text-fg transition-colors"
          aria-label="Increase font size"
        >
          +
        </button>
      </div>
    </div>
  )
}
