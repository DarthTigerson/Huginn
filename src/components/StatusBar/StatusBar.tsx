import { useFontSizeStore } from '@/stores/fontSizeStore'

export function StatusBar() {
  const { fontSize, increase, decrease } = useFontSizeStore()

  return (
    <div className="h-6 shrink-0 flex items-center justify-end px-3 bg-tab-bar border-t border-border select-none">
      <div className="flex items-center gap-1.5 text-fg-muted">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <button
          type="button"
          onClick={decrease}
          className="w-4 h-4 flex items-center justify-center text-xs hover:text-fg transition-colors leading-none"
          aria-label="Decrease font size"
        >
          −
        </button>
        <span className="text-xs tabular-nums w-6 text-center">{fontSize}</span>
        <button
          type="button"
          onClick={increase}
          className="w-4 h-4 flex items-center justify-center text-xs hover:text-fg transition-colors leading-none"
          aria-label="Increase font size"
        >
          +
        </button>
      </div>
    </div>
  )
}
