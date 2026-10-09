import { useDisplayStore } from '@/stores/displayStore'
import { PreviewFrame } from './primitives'

// Live pictures for Settings › Display (VIDE-145).

export function MemoryPreview() {
  const visible = useDisplayStore((s) => s.memoryUsageVisible)
  return (
    <PreviewFrame testId="memory-preview" caption="Title bar">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-fg-subtle/60" />)}
        </span>
        <span className="flex-1" />
        {visible && (
          <span data-testid="memory-preview-pill" className="rounded-full border border-border px-2 text-[10px] text-fg-muted">
            12.4 / 32 GB
          </span>
        )}
        <span className="rounded border border-border px-2 text-[10px] text-fg">Claude ▾</span>
      </div>
    </PreviewFrame>
  )
}

export function NavbarPreview() {
  const right = useDisplayStore((s) => s.navbarPosition) === 'right'
  const nav = <span className="w-2.5 shrink-0 bg-sidebar" />
  const files = <span className="flex w-14 shrink-0 items-start justify-center border-x border-border bg-sidebar/60 pt-1 text-[9px] text-fg-muted">Files</span>
  const chat = <span className="flex w-16 shrink-0 items-start justify-center border-x border-border bg-sidebar/60 pt-1 text-[9px] text-fg-muted">Claude</span>
  const editor = <span className="flex flex-1 items-start justify-center pt-1 text-[9px] text-fg-subtle">editor</span>
  return (
    <PreviewFrame testId="navbar-preview">
      <div data-side={right ? 'right' : 'left'} className="flex h-[84px]">
        {right ? <>{nav}{chat}{editor}{files}{nav}</> : <>{nav}{files}{editor}{chat}{nav}</>}
      </div>
    </PreviewFrame>
  )
}
