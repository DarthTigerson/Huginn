export function clampSize(size: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, size))
}

// localStorage.getItem returns null when a key is unset, and Number(null) is
// 0 (not NaN) — without the explicit null check, isFinite(0) is true and a
// fresh launch would silently clamp to `min` instead of ever reaching
// `defaultSize`.
export function loadPanelSize(key: string, defaultSize: number, min: number, max: number): number {
  const raw = localStorage.getItem(key)
  if (raw === null) return defaultSize
  const stored = Number(raw)
  return Number.isFinite(stored) ? clampSize(stored, min, max) : defaultSize
}
