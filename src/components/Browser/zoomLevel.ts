// Electron's zoom level → factor formula (matches Chromium's own PageZoom):
// each whole level is a 20% step, compounding — level 0 is 100%, level 1 is
// 120%, level -1 is ~83%, etc.
export function zoomLevelToPercent(level: number): number {
  return Math.round(1.2 ** level * 100)
}
