import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  return { store }
})

vi.mock('../../lib/notifySettingChanged', () => ({ notifySettingChanged: vi.fn() }))

import { useEditorSettingsStore } from '../editorSettingsStore'
import { notifySettingChanged } from '../../lib/notifySettingChanged'

describe('editorSettingsStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    useEditorSettingsStore.setState({
      autoSaveEnabled: false,
      wordWrapEnabled: false,
      changeAllOccurrencesInMenu: false,
    })
  })

  it('has correct defaults', () => {
    expect(useEditorSettingsStore.getState().autoSaveEnabled).toBe(false)
    expect(useEditorSettingsStore.getState().wordWrapEnabled).toBe(false)
    expect(useEditorSettingsStore.getState().changeAllOccurrencesInMenu).toBe(false)
  })

  it('has git blame on and shown in the footer by default', () => {
    expect(useEditorSettingsStore.getState().blameAnnotationsEnabled).toBe(true)
    expect(useEditorSettingsStore.getState().blameDisplayMode).toBe('footer')
  })

  it('keeps a saved choice to show blame in the editor', async () => {
    store['vide:git:blameDisplayMode'] = 'editor'
    vi.resetModules()
    const { useEditorSettingsStore: fresh } = await import('../editorSettingsStore')
    expect(fresh.getState().blameDisplayMode).toBe('editor')
  })

  it('saves the blame settings under the git sync prefix and pushes them to vIDE Sync', () => {
    vi.mocked(notifySettingChanged).mockClear()
    useEditorSettingsStore.getState().setBlameAnnotationsEnabled(false)
    useEditorSettingsStore.getState().setBlameDisplayMode('editor')
    expect(store['vide:git:blameAnnotationsEnabled']).toBe('false')
    expect(store['vide:git:blameDisplayMode']).toBe('editor')
    expect(notifySettingChanged).toHaveBeenCalledTimes(2)
  })

  it('has the inline diff highlight on by default', () => {
    expect(useEditorSettingsStore.getState().inlineDiffEnabled).toBe(true)
  })

  it('toggleInlineDiff flips, persists and syncs the inline diff highlight', () => {
    vi.mocked(notifySettingChanged).mockClear()
    useEditorSettingsStore.getState().toggleInlineDiff()
    expect(useEditorSettingsStore.getState().inlineDiffEnabled).toBe(false)
    expect(store['vide:git:inlineDiffEnabled']).toBe('false')
    expect(notifySettingChanged).toHaveBeenCalledTimes(1)
  })

  it('setChangeAllOccurrencesInMenu persists to localStorage', () => {
    useEditorSettingsStore.getState().setChangeAllOccurrencesInMenu(true)
    expect(useEditorSettingsStore.getState().changeAllOccurrencesInMenu).toBe(true)
    expect(store['vide:editor:changeAllOccurrencesInMenu']).toBe('true')
  })

  it('setAutoSaveEnabled persists to localStorage', () => {
    useEditorSettingsStore.getState().setAutoSaveEnabled(true)
    expect(useEditorSettingsStore.getState().autoSaveEnabled).toBe(true)
    expect(store['vide:editor:autoSaveEnabled']).toBe('true')
  })

  it('toggleWordWrap flips the value and persists it', () => {
    useEditorSettingsStore.getState().toggleWordWrap()
    expect(useEditorSettingsStore.getState().wordWrapEnabled).toBe(true)
    expect(store['vide:editor:wordWrapEnabled']).toBe('true')

    useEditorSettingsStore.getState().toggleWordWrap()
    expect(useEditorSettingsStore.getState().wordWrapEnabled).toBe(false)
    expect(store['vide:editor:wordWrapEnabled']).toBe('false')
  })
})
