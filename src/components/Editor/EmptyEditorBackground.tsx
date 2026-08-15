import { useDisplayStore } from '@/stores/displayStore'

export function EmptyEditorBackground() {
  const visible = useDisplayStore((s) => s.backgroundImageVisible)
  if (!visible) return null
  return <div className="absolute inset-0 empty-editor-bg pointer-events-none" aria-hidden="true" />
}
