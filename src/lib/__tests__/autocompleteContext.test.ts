import { describe, it, expect } from 'vitest'
import { getCompletionContext, type TextModelLike } from '../autocompleteContext'

function makeModel(lines: string[]): TextModelLike {
  return {
    getLineCount: () => lines.length,
    getLineMaxColumn: (lineNumber: number) => lines[lineNumber - 1].length + 1,
    getValueInRange: (range) => {
      const result: string[] = []
      for (let ln = range.startLineNumber; ln <= range.endLineNumber; ln++) {
        const line = lines[ln - 1]
        const start = ln === range.startLineNumber ? range.startColumn - 1 : 0
        const end = ln === range.endLineNumber ? range.endColumn - 1 : line.length
        result.push(line.slice(start, end))
      }
      return result.join('\n')
    },
  }
}

describe('getCompletionContext', () => {
  it('splits prefix and suffix at the cursor position', () => {
    const model = makeModel(['const x = 1', 'const y = 2', 'const z = 3'])
    const { prefix, suffix } = getCompletionContext(model, { lineNumber: 2, column: 8 })
    expect(prefix).toBe('const x = 1\nconst y')
    expect(suffix).toBe(' = 2\nconst z = 3')
  })

  it('caps the prefix to the last 100 lines before the cursor', () => {
    const lines = Array.from({ length: 150 }, (_, i) => `line${i + 1}`)
    const model = makeModel(lines)
    const { prefix } = getCompletionContext(model, { lineNumber: 150, column: 1 })
    const prefixLines = prefix.split('\n')
    expect(prefixLines.length).toBe(100)
    expect(prefixLines[0]).toBe('line51')
  })

  it('caps the suffix to 50 lines after the cursor (inclusive of the cursor line)', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line${i + 1}`)
    const model = makeModel(lines)
    const { suffix } = getCompletionContext(model, { lineNumber: 1, column: 1 })
    expect(suffix.split('\n').length).toBe(50)
  })

  it('does not run past the start of the file', () => {
    const model = makeModel(['only line'])
    const { prefix } = getCompletionContext(model, { lineNumber: 1, column: 5 })
    expect(prefix).toBe('only')
  })

  it('does not run past the end of the file', () => {
    const model = makeModel(['only line'])
    const { suffix } = getCompletionContext(model, { lineNumber: 1, column: 5 })
    expect(suffix).toBe(' line')
  })

  it('caps prefix length to 4000 characters', () => {
    const model = makeModel(['x'.repeat(5000)])
    const { prefix } = getCompletionContext(model, { lineNumber: 1, column: 5001 })
    expect(prefix.length).toBe(4000)
  })

  it('caps suffix length to 2000 characters', () => {
    const model = makeModel(['x'.repeat(5000)])
    const { suffix } = getCompletionContext(model, { lineNumber: 1, column: 1 })
    expect(suffix.length).toBe(2000)
  })
})
