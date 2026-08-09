import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteSessionStore } from '@/stores/autocompleteSessionStore'

export function isAutocompleteEffectivelyEnabled(): boolean {
  return useAutocompleteSettingsStore.getState().enabled && !useAutocompleteSessionStore.getState().paused
}
