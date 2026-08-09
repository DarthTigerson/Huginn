import { describe, it, expect, beforeEach } from 'vitest'
import { useAutocompleteSessionStore } from '../autocompleteSessionStore'

describe('autocompleteSessionStore', () => {
  beforeEach(() => {
    useAutocompleteSessionStore.setState({ paused: false })
  })

  it('defaults to not paused', () => {
    expect(useAutocompleteSessionStore.getState().paused).toBe(false)
  })

  it('togglePaused flips the flag', () => {
    useAutocompleteSessionStore.getState().togglePaused()
    expect(useAutocompleteSessionStore.getState().paused).toBe(true)
    useAutocompleteSessionStore.getState().togglePaused()
    expect(useAutocompleteSessionStore.getState().paused).toBe(false)
  })
})
