export interface TextModelLike {
  getLineCount(): number
  getLineMaxColumn(lineNumber: number): number
  getValueInRange(range: {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }): string
}

export interface PositionLike {
  lineNumber: number
  column: number
}

const MAX_PREFIX_LINES = 100
const MAX_SUFFIX_LINES = 50
const MAX_PREFIX_CHARS = 4000
const MAX_SUFFIX_CHARS = 2000

export function getCompletionContext(
  model: TextModelLike,
  position: PositionLike
): { prefix: string; suffix: string } {
  const startLine = Math.max(1, position.lineNumber - MAX_PREFIX_LINES + 1)
  const endLine = Math.min(model.getLineCount(), position.lineNumber + MAX_SUFFIX_LINES - 1)

  const prefix = model.getValueInRange({
    startLineNumber: startLine,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  })

  const suffix = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: position.column,
    endLineNumber: endLine,
    endColumn: model.getLineMaxColumn(endLine),
  })

  return {
    prefix: prefix.slice(-MAX_PREFIX_CHARS),
    suffix: suffix.slice(0, MAX_SUFFIX_CHARS),
  }
}
