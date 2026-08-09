import { describe, it, expect } from 'vitest'
import { isShiftEnterKeydown } from '../shiftEnterSequence'

function keydown(overrides: Partial<KeyboardEventInit> = {}) {
  return new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, ...overrides })
}

describe('isShiftEnterKeydown', () => {
  it('matches Shift+Enter with no other modifiers', () => {
    expect(isShiftEnterKeydown(keydown())).toBe(true)
  })

  it('does not match plain Enter', () => {
    expect(isShiftEnterKeydown(keydown({ shiftKey: false }))).toBe(false)
  })

  it('does not match Shift+Enter combined with Meta/Ctrl/Alt', () => {
    expect(isShiftEnterKeydown(keydown({ metaKey: true }))).toBe(false)
    expect(isShiftEnterKeydown(keydown({ ctrlKey: true }))).toBe(false)
    expect(isShiftEnterKeydown(keydown({ altKey: true }))).toBe(false)
  })

  it('does not match other keys with shift held', () => {
    expect(isShiftEnterKeydown(keydown({ key: 'Tab' }))).toBe(false)
  })

  it('ignores non-keydown event types', () => {
    const event = new KeyboardEvent('keyup', { key: 'Enter', shiftKey: true })
    expect(isShiftEnterKeydown(event)).toBe(false)
  })
})
