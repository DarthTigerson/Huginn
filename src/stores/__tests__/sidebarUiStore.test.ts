import { describe, it, expect, beforeEach } from 'vitest'
import { useSidebarUiStore } from '../sidebarUiStore'

describe('sidebarUiStore', () => {
  beforeEach(() => {
    useSidebarUiStore.setState({ pendingCreate: null })
  })

  it('starts with no pending create', () => {
    expect(useSidebarUiStore.getState().pendingCreate).toBeNull()
  })

  it('requestCreate sets pendingCreate to the requested kind', () => {
    useSidebarUiStore.getState().requestCreate('file')
    expect(useSidebarUiStore.getState().pendingCreate).toBe('file')
  })

  it('clearPendingCreate resets to null', () => {
    useSidebarUiStore.getState().requestCreate('directory')
    useSidebarUiStore.getState().clearPendingCreate()
    expect(useSidebarUiStore.getState().pendingCreate).toBeNull()
  })
})
