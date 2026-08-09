import { describe, it, expect } from 'vitest'
import { postProcessEditText } from '../inlineEditMonaco'

describe('postProcessEditText', () => {
  it('passes through a plain single-line replacement unchanged', () => {
    expect(postProcessEditText('bar()')).toBe('bar()')
  })

  it('preserves a trailing newline for a full-line selection replacement', () => {
    expect(postProcessEditText('bar();\n')).toBe('bar();\n')
  })

  it("preserves the first line's leading indentation when there is no leading blank line", () => {
    expect(postProcessEditText('  return a + b;\n  return c;')).toBe('  return a + b;\n  return c;')
  })

  it('strips a leading blank-line run without touching the following line\'s indentation', () => {
    expect(postProcessEditText('\n\n  const x = 1;')).toBe('  const x = 1;')
  })

  it('strips a single leading blank line the same as multiple', () => {
    expect(postProcessEditText('\n  const x = 1;')).toBe('  const x = 1;')
  })

  it('does not treat leading indentation on the first line as a blank-line run', () => {
    // The whole first line is blank-looking ("  ") but has no trailing \n of
    // its own before real content starts on the SAME line — nothing to strip.
    expect(postProcessEditText('  ')).toBe('  ')
  })

  it('extracts a fenced code block, preferring it over surrounding prose', () => {
    expect(postProcessEditText("Here's the fix:\n```ts\nconst y = 2;\n```")).toBe('const y = 2;')
  })

  it('extracts a fenced code block with no language tag', () => {
    expect(postProcessEditText('```\nconst y = 2;\n```')).toBe('const y = 2;')
  })

  it('extracts a fenced block that itself contains a trailing blank line', () => {
    expect(postProcessEditText('```ts\nconst y = 2;\n\n```')).toBe('const y = 2;\n')
  })
})
