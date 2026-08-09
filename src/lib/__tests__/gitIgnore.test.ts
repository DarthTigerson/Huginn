import { describe, it, expect } from 'vitest'
import { isIgnoredPath } from '../gitIgnore'

describe('isIgnoredPath', () => {
  const root = '/proj'
  const ignored = ['node_modules', 'debug.log', 'src/generated']

  it('matches a directly ignored file', () => {
    expect(isIgnoredPath('/proj/debug.log', root, ignored)).toBe(true)
  })

  it('matches a directly ignored directory', () => {
    expect(isIgnoredPath('/proj/node_modules', root, ignored)).toBe(true)
  })

  it('matches descendants of an ignored directory', () => {
    expect(isIgnoredPath('/proj/node_modules/pkg/index.js', root, ignored)).toBe(true)
    expect(isIgnoredPath('/proj/src/generated/types.ts', root, ignored)).toBe(true)
  })

  it('does not match tracked files', () => {
    expect(isIgnoredPath('/proj/src/index.ts', root, ignored)).toBe(false)
  })

  it('does not false-positive on a sibling that shares a prefix', () => {
    expect(isIgnoredPath('/proj/node_modules2/index.js', root, ignored)).toBe(false)
  })

  it('returns false when there are no ignored paths', () => {
    expect(isIgnoredPath('/proj/debug.log', root, [])).toBe(false)
  })
})
