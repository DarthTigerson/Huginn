import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildUserPrompt, postProcessCompletion } from '../autocomplete'

describe('buildSystemPrompt', () => {
  it('instructs the model to respond with only the completion text', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('ONLY')
    expect(prompt).toContain('no markdown code fences')
  })
})

describe('buildUserPrompt', () => {
  it('wraps prefix and suffix with language and tags', () => {
    const prompt = buildUserPrompt('const x = ', ';\n', 'typescript')
    expect(prompt).toBe('Language: typescript\n<prefix>\nconst x = \n</prefix>\n<suffix>\n;\n\n</suffix>')
  })
})

describe('postProcessCompletion', () => {
  it('returns trimmed text unchanged when there are no code fences', () => {
    expect(postProcessCompletion('  const y = 2  \n')).toBe('const y = 2')
  })

  it('strips a fenced code block with a language tag', () => {
    expect(postProcessCompletion('```typescript\nconst y = 2\n```')).toBe('const y = 2')
  })

  it('strips a fenced code block with no language tag', () => {
    expect(postProcessCompletion('```\nconst y = 2\n```')).toBe('const y = 2')
  })

  it('returns null for an empty response', () => {
    expect(postProcessCompletion('   ')).toBeNull()
  })

  it('returns null when the fenced block is empty', () => {
    expect(postProcessCompletion('```\n\n```')).toBeNull()
  })
})
