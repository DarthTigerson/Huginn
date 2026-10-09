import { describe, it, expect } from 'vitest'
import { computeLineChanges, computeInlineRanges, computeDiff } from '../lineDiff'

describe('computeLineChanges', () => {
  it('returns nothing for identical content', () => {
    expect(computeLineChanges('a\nb\nc\n', 'a\nb\nc\n')).toEqual([])
  })

  it('marks a pure addition at the new line range', () => {
    const changes = computeLineChanges('a\nb\n', 'a\nb\nc\nd\n')
    expect(changes).toEqual([{ type: 'added', startLine: 3, endLine: 4 }])
  })

  it('marks a replaced line as modified', () => {
    const changes = computeLineChanges('a\nb\nc\n', 'a\nX\nc\n')
    expect(changes).toEqual([{ type: 'modified', startLine: 2, endLine: 2 }])
  })

  it('marks a pure deletion at the line before the gap', () => {
    const changes = computeLineChanges('a\nb\nc\n', 'a\nc\n')
    expect(changes).toEqual([{ type: 'deleted', startLine: 1, endLine: 1 }])
  })

  it('marks a deletion at the very start of the file as line 1', () => {
    const changes = computeLineChanges('a\nb\n', 'b\n')
    expect(changes).toEqual([{ type: 'deleted', startLine: 1, endLine: 1 }])
  })

  it('treats every line as added for a new/untracked file (empty HEAD content)', () => {
    const changes = computeLineChanges('', 'a\nb\n')
    expect(changes).toEqual([{ type: 'added', startLine: 1, endLine: 2 }])
  })

  it('handles multiple independent hunks', () => {
    const head = 'a\nb\nc\nd\ne\n'
    const current = 'a\nX\nc\nd\ne\nf\n'
    const changes = computeLineChanges(head, current)
    expect(changes).toEqual([
      { type: 'modified', startLine: 2, endLine: 2 },
      { type: 'added', startLine: 6, endLine: 6 },
    ])
  })

  it('ignores a lone trailing-newline difference (common for files missing a final newline at HEAD)', () => {
    expect(computeLineChanges('a\nb\nc', 'a\nb\nc\n')).toEqual([])
    expect(computeLineChanges('a\nb\nc\n', 'a\nb\nc')).toEqual([])
  })

  it('ignores CRLF vs LF differences alone (e.g. autocrlf-converted checkouts)', () => {
    expect(computeLineChanges('a\r\nb\r\nc\r\n', 'a\nb\nc\n')).toEqual([])
  })
})

describe('computeInlineRanges', () => {
  it('returns nothing for identical lines', () => {
    expect(computeInlineRanges('const foo = 1;', 'const foo = 1;')).toEqual([])
  })

  it('highlights just the changed token, not the whole line', () => {
    const oldLine = 'const foo = 1;'
    const newLine = 'const foo = 2;'
    const ranges = computeInlineRanges(oldLine, newLine)
    expect(ranges).toEqual([{ startColumn: 13, endColumn: 14 }])
    expect(newLine.slice(ranges[0].startColumn - 1, ranges[0].endColumn - 1)).toBe('2')
  })

  it('highlights an inserted word (and its trailing space) in place', () => {
    const oldLine = 'hello world'
    const newLine = 'hello brave world'
    const ranges = computeInlineRanges(oldLine, newLine)
    expect(ranges).toEqual([{ startColumn: 7, endColumn: 13 }])
    expect(newLine.slice(ranges[0].startColumn - 1, ranges[0].endColumn - 1)).toBe('brave ')
  })

  it('returns multiple ranges when changed words are not adjacent', () => {
    const oldLine = 'foo bar baz'
    const newLine = 'foo qux quux baz'
    const ranges = computeInlineRanges(oldLine, newLine)
    const substrings = ranges.map((r) => newLine.slice(r.startColumn - 1, r.endColumn - 1))
    expect(substrings).toEqual(['qux', 'quux '])
  })

  it('treats a line with no old counterpart as fully added', () => {
    const newLine = 'new text'
    const ranges = computeInlineRanges('', newLine)
    expect(ranges).toEqual([{ startColumn: 1, endColumn: 9 }])
  })
})

describe('computeDiff inlineDiffs', () => {
  const inline = (head: string, current: string) => computeDiff(head, current).inlineDiffs

  it('returns no inline diffs for identical content', () => {
    expect(inline('a\nb\nc\n', 'a\nb\nc\n')).toEqual([])
  })

  it('pairs a single modified line with its inline ranges', () => {
    const diffs = inline('a\nconst foo = 1;\nc\n', 'a\nconst foo = 2;\nc\n')
    expect(diffs).toEqual([{ line: 2, ranges: [{ startColumn: 13, endColumn: 14 }] }])
  })

  it('never runs on pure additions or deletions', () => {
    expect(inline('a\nb\n', 'a\nb\nc\nd\n')).toEqual([])
    expect(inline('a\nb\nc\n', 'a\nc\n')).toEqual([])
  })

  it('pairs old/new lines by index when a hunk replaces N lines with M != N lines, leaving extras uncovered', () => {
    const diffs = inline(
      'a\nconst foo = 1;\nconst bar = 1;\nd\n',
      'a\nconst foo = 2;\nconst bar = 2;\nY\nZ\nd\n',
    )
    expect(diffs).toEqual([
      { line: 2, ranges: [{ startColumn: 13, endColumn: 14 }] },
      { line: 3, ranges: [{ startColumn: 13, endColumn: 14 }] },
    ])
  })

  it('highlights a fully rewritten line end to end', () => {
    expect(inline('a\nb\nc\n', 'a\nX\nc\n')).toEqual([{ line: 2, ranges: [{ startColumn: 1, endColumn: 2 }] }])
  })

  it('skips lines longer than the inline length cap', () => {
    const oldLine = 'x'.repeat(1200) + ' 1'
    const newLine = 'x'.repeat(1200) + ' 2'
    expect(inline(`a\n${oldLine}\nc\n`, `a\n${newLine}\nc\n`)).toEqual([])
  })

  it('skips hunks larger than the inline hunk cap but still marks them modified', () => {
    const count = 600
    const head = Array.from({ length: count }, (_, i) => `const v${i} = 1;`).join('\n') + '\n'
    const current = Array.from({ length: count }, (_, i) => `const v${i} = 2;`).join('\n') + '\n'
    const result = computeDiff(head, current)
    expect(result.inlineDiffs).toEqual([])
    expect(result.changes).toEqual([{ type: 'modified', startLine: 1, endLine: count }])
  })
})

describe('computeDiff', () => {
  it('returns the same changes as computeLineChanges from a single pass', () => {
    const head = 'a\nb\nc\nd\ne\n'
    const current = 'a\nX\nc\nd\ne\nf\n'
    expect(computeDiff(head, current).changes).toEqual(computeLineChanges(head, current))
  })
})
