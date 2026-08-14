export type DropZone = 'center' | 'left' | 'right' | 'up' | 'down'

const EDGE_FRACTION = 0.25

// Same 5-zone model VS Code and common docking libraries (dockview, rc-dock)
// use: the outer 25% of each edge means "split that direction," everything
// else means "drop into this pane's tabs." Left/right are checked before
// up/down, so left/right claim the full height of the pane including
// corners - up/down only own the middle horizontal band.
export function computeDropZone(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number
): DropZone {
  const fracX = (clientX - rect.left) / rect.width
  const fracY = (clientY - rect.top) / rect.height

  if (fracX <= EDGE_FRACTION) return 'left'
  if (fracX >= 1 - EDGE_FRACTION) return 'right'
  if (fracY <= EDGE_FRACTION) return 'up'
  if (fracY >= 1 - EDGE_FRACTION) return 'down'
  return 'center'
}
