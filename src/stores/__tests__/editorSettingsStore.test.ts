import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  return { store }
})

import { useEditorSettingsStore } from '../editorSettingsStore'

describe('editorSettingsStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    useEditorSettingsStore.setState({
      autoSaveEnabled: false,
    })
  })

  it('has correct defaults', () => {
    expect(useEditorSettingsStore.getState().autoSaveEnabled).toBe(false)
  })

  it('setAutoSaveEnabled persists to localStorage', () => {
    useEditorSettingsStore.getState().setAutoSaveEnabled(true)
    expect(useEditorSettingsStore.getState().autoSaveEnabled).toBe(true)
    expect(store['huginn:editor:autoSaveEnabled']).toBe('true')
  })
})
