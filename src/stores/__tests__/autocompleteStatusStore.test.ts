import { describe, it, expect, beforeEach } from 'vitest'
import { useAutocompleteStatusStore } from '../autocompleteStatusStore'

describe('autocompleteStatusStore', () => {
  beforeEach(() => {
    useAutocompleteStatusStore.setState({ busy: false })
  })

  it('defaults to not busy', () => {
    expect(useAutocompleteStatusStore.getState().busy).toBe(false)
  })

  it('setBusy updates the flag', () => {
    useAutocompleteStatusStore.getState().setBusy(true)
    expect(useAutocompleteStatusStore.getState().busy).toBe(true)
  })
})
