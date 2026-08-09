// Claude Code's CLI reads ESC+CR from stdin as "insert newline", distinct from
// the plain CR that Enter alone sends for "submit". Terminals that support
// this (iTerm2, VS Code, Alacritty, Zed, ...) install a Shift+Enter binding
// that sends this exact sequence; our embedded xterm.js terminal needs to do
// the same since it has no such binding by default.
export const SHIFT_ENTER_SEQUENCE = '\x1b\r'

export function isShiftEnterKeydown(event: KeyboardEvent): boolean {
  return (
    event.type === 'keydown' &&
    event.key === 'Enter' &&
    event.shiftKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  )
}
