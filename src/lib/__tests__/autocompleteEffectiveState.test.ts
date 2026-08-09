import { describe, it, expect, beforeEach } from 'vitest'
import { isAutocompleteEffectivelyEnabled } from '../autocompleteEffectiveState'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteSessionStore } from '@/stores/autocompleteSessionStore'

describe('isAutocompleteEffectivelyEnabled', () => {
  beforeEach(() => {
    useAutocompleteSettingsStore.setState({ enabled: true })
    useAutocompleteSessionStore.setState({ paused: false })
  })

  it('is true when enabled and not paused', () => {
    expect(isAutocompleteEffectivelyEnabled()).toBe(true)
  })

  it('is false when disabled in settings', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    expect(isAutocompleteEffectivelyEnabled()).toBe(false)
  })

  it('is false when session-paused', () => {
    useAutocompleteSessionStore.setState({ paused: true })
    expect(isAutocompleteEffectivelyEnabled()).toBe(false)
  })

  it('is false when both disabled and paused', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    useAutocompleteSessionStore.setState({ paused: true })
    expect(isAutocompleteEffectivelyEnabled()).toBe(false)
  })
})
