import { describe, it, expect } from 'vitest'
import { parseRefTarget } from '../commitFormat'

describe('parseRefTarget', () => {
  it('resolves a plain local branch name', () => {
    expect(parseRefTarget('feature-x')).toEqual({ name: 'feature-x', kind: 'local' })
  })

  it('resolves a remote-tracking ref, stripping the origin/ prefix', () => {
    expect(parseRefTarget('origin/feature-x')).toEqual({ name: 'feature-x', kind: 'remote' })
  })

  it('resolves a tag, stripping the "tag: " prefix', () => {
    expect(parseRefTarget('tag: v1.0')).toEqual({ name: 'v1.0', kind: 'tag' })
  })

  it('returns null for a bare detached HEAD', () => {
    expect(parseRefTarget('HEAD')).toBeNull()
  })

  it('resolves the currently checked out branch (HEAD -> branch) as a local branch too', () => {
    expect(parseRefTarget('HEAD -> main')).toEqual({ name: 'main', kind: 'local' })
  })
})
