import { useFontSizeStore } from '@/stores/fontSizeStore'

export function StatusBar() {
  const { fontSize, increase, decrease, reset } = useFontSizeStore()

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
        <span
          className="tabular-nums w-6 text-center cursor-default"
          onContextMenu={(e) => { e.preventDefault(); reset() }}
          title="Right-click to reset"
        >
          {fontSize}
        </span>
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
