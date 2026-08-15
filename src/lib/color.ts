// Appends an alpha channel to a 6-digit hex color, e.g. hexWithAlpha('#1e1e1e', 0.25)
// -> '#1e1e1e40'. Used to derive glass-panel-style variants of Monaco/xterm
// theme backgrounds, which are hardcoded hex colors independent of the
// --color-panel/--color-bg CSS custom properties the rest of the UI uses.
export function hexWithAlpha(hex: string, alpha: number): string {
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  return hex + byte.toString(16).padStart(2, '0')
}
