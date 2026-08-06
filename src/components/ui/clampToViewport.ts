export function clampToViewport(x: number, y: number, width: number, height: number, margin = 4) {
  return {
    x: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
    y: Math.max(margin, Math.min(y, window.innerHeight - height - margin)),
  }
}
