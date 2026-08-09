import { describe, it, expect } from 'vitest'
import { buildEditSystemPrompt, buildEditPrompt, parseStreamJsonLine } from '../inlineEdit'

describe('buildEditSystemPrompt', () => {
  it('instructs the model to respond with only the replacement code', () => {
    const prompt = buildEditSystemPrompt()
    expect(prompt).toContain('ONLY')
    expect(prompt).toContain('no markdown code fences')
  })
})

describe('buildEditPrompt', () => {
  it('wraps prefix, selection, suffix, language, and the instruction', () => {
    const prompt = buildEditPrompt('const x = 1\n', 'const y = 2\n', 'foo()', 'add a comment', 'typescript')
    expect(prompt).toBe(
      'Language: typescript\n<prefix>\nconst x = 1\n\n</prefix>\n<selection>\nfoo()\n</selection>\n<suffix>\nconst y = 2\n\n</suffix>\n\nInstruction: add a comment'
    )
  })

  it('handles an empty selection (insert mode)', () => {
    const prompt = buildEditPrompt('const x = 1\n', '', '', 'add a log line', 'typescript')
    expect(prompt).toBe(
      'Language: typescript\n<prefix>\nconst x = 1\n\n</prefix>\n<selection>\n\n</selection>\n<suffix>\n\n</suffix>\n\nInstruction: add a log line'
    )
  })
})

describe('parseStreamJsonLine', () => {
  it('extracts a text delta from a content_block_delta event', () => {
    const line = '{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"hello world"}},"session_id":"abc"}'
    expect(parseStreamJsonLine(line)).toEqual({ type: 'delta', text: 'hello world' })
  })

  it('ignores a thinking_delta event', () => {
    const line = '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"reasoning..."}},"session_id":"abc"}'
    expect(parseStreamJsonLine(line)).toBeNull()
  })

  it('ignores a signature_delta event', () => {
    const line = '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"abc123"}},"session_id":"abc"}'
    expect(parseStreamJsonLine(line)).toBeNull()
  })

  it('reports a successful result line', () => {
    const line = '{"is_error":false,"result":"hello world","type":"result","subtype":"success"}'
    expect(parseStreamJsonLine(line)).toEqual({ type: 'result', isError: false })
  })

  it('reports a failed result line', () => {
    const line = '{"is_error":true,"result":"","type":"result","subtype":"error"}'
    expect(parseStreamJsonLine(line)).toEqual({ type: 'result', isError: true })
  })

  it('ignores an unrelated system event', () => {
    const line = '{"type":"system","subtype":"init","session_id":"abc"}'
    expect(parseStreamJsonLine(line)).toBeNull()
  })

  it('ignores a content_block_start event', () => {
    const line = '{"type":"stream_event","event":{"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}}'
    expect(parseStreamJsonLine(line)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseStreamJsonLine('not json')).toBeNull()
  })

  it('returns null for an empty line', () => {
    expect(parseStreamJsonLine('')).toBeNull()
  })
})
