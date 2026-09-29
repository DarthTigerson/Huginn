import { describe, it, expect, beforeEach } from 'vitest'
import { useFooterBlameStore, type FooterBlame } from '../footerBlameStore'

function commit(author: string, summary: string): FooterBlame {
  return { kind: 'commit', author, summary, date: '2026-09-14 10:22:05', relDate: '2 days ago' }
}

describe('footerBlameStore', () => {
  beforeEach(() => {
    useFooterBlameStore.setState({ blame: null, owner: null })
  })

  it('shows whatever the latest publisher sent', () => {
    const a = {}
    useFooterBlameStore.getState().publish(a, commit('Ada', 'Fix'))
    expect(useFooterBlameStore.getState().blame).toEqual(commit('Ada', 'Fix'))
  })

  it('lets a second editor take over the footer', () => {
    const a = {}
    const b = {}
    useFooterBlameStore.getState().publish(a, commit('a', 'from a'))
    useFooterBlameStore.getState().publish(b, commit('b', 'from b'))
    expect(useFooterBlameStore.getState().blame).toEqual(commit('b', 'from b'))
  })

  it('only clears when the current owner releases it', () => {
    const a = {}
    const b = {}
    useFooterBlameStore.getState().publish(a, commit('a', 'from a'))
    useFooterBlameStore.getState().publish(b, commit('b', 'from b'))
    useFooterBlameStore.getState().release(a)
    expect(useFooterBlameStore.getState().blame).toEqual(commit('b', 'from b'))
    useFooterBlameStore.getState().release(b)
    expect(useFooterBlameStore.getState().blame).toBeNull()
  })
})
