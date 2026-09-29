import { describe, it, expect, beforeEach } from 'vitest'
import { useFooterBlameStore } from '../footerBlameStore'

describe('footerBlameStore', () => {
  beforeEach(() => {
    useFooterBlameStore.setState({ blame: null, owner: null })
  })

  it('shows whatever the latest publisher sent', () => {
    const a = {}
    useFooterBlameStore.getState().publish(a, { text: 'Ada, 2 days ago • Fix', hover: 'Fix' })
    expect(useFooterBlameStore.getState().blame?.text).toBe('Ada, 2 days ago • Fix')
  })

  it('lets a second editor take over the footer', () => {
    const a = {}
    const b = {}
    useFooterBlameStore.getState().publish(a, { text: 'from a', hover: '' })
    useFooterBlameStore.getState().publish(b, { text: 'from b', hover: '' })
    expect(useFooterBlameStore.getState().blame?.text).toBe('from b')
  })

  it('only clears when the current owner releases it', () => {
    const a = {}
    const b = {}
    useFooterBlameStore.getState().publish(a, { text: 'from a', hover: '' })
    useFooterBlameStore.getState().publish(b, { text: 'from b', hover: '' })
    useFooterBlameStore.getState().release(a)
    expect(useFooterBlameStore.getState().blame?.text).toBe('from b')
    useFooterBlameStore.getState().release(b)
    expect(useFooterBlameStore.getState().blame).toBeNull()
  })
})
