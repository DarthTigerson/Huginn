export interface SelectionForAssistant {
  relPath: string
  startLine: number
  endLine: number
  language: string
  code: string
}

export function toRelativePath(absPath: string, projectRoot: string | null): string {
  if (!projectRoot) return absPath
  const prefix = projectRoot.endsWith('/') ? projectRoot : `${projectRoot}/`
  return absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath
}

export function formatSelectionForAssistant({ relPath, startLine, endLine, language, code }: SelectionForAssistant): string {
  const lineLabel = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`
  return `In ${relPath} (${lineLabel}):\n\`\`\`${language}\n${code}\n\`\`\``
}

// The bracketed-paste protocol every real terminal uses to deliver a
// multi-line paste to a foreground CLI in one shot, so embedded newlines
// aren't read as separate keystrokes/submits by the CLI's line editor.
export const BRACKETED_PASTE_START = '\x1b[200~'
export const BRACKETED_PASTE_END = '\x1b[201~'

export function wrapBracketedPaste(text: string): string {
  return `${BRACKETED_PASTE_START}${text}${BRACKETED_PASTE_END}`
}
