import { describe, it, expect } from 'vitest'
import { computeLineChanges } from '../lineDiff'

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
