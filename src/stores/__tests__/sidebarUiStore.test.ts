import { describe, it, expect, beforeEach } from 'vitest'
import { useSidebarUiStore } from '../sidebarUiStore'

describe('sidebarUiStore', () => {
  beforeEach(() => {
    useSidebarUiStore.setState({ pendingCreate: null, revealRequest: null })
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

  it('starts with no reveal request', () => {
    expect(useSidebarUiStore.getState().revealRequest).toBeNull()
  })

  it('requestReveal sets revealRequest to the given path', () => {
    useSidebarUiStore.getState().requestReveal('/proj/src/App.tsx')
    expect(useSidebarUiStore.getState().revealRequest).toEqual({ path: '/proj/src/App.tsx', expandTarget: undefined })
  })

  it('requestReveal carries an expandTarget flag through when passed', () => {
    useSidebarUiStore.getState().requestReveal('/proj/repoA', true)
    expect(useSidebarUiStore.getState().revealRequest).toEqual({ path: '/proj/repoA', expandTarget: true })
  })

  it('requestReveal creates a fresh object each call, so repeat requests for the same path are still a change', () => {
    useSidebarUiStore.getState().requestReveal('/proj/src/App.tsx')
    const first = useSidebarUiStore.getState().revealRequest
    useSidebarUiStore.getState().requestReveal('/proj/src/App.tsx')
    const second = useSidebarUiStore.getState().revealRequest
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
  })

  it('clearRevealRequest resets to null', () => {
    useSidebarUiStore.getState().requestReveal('/proj/src/App.tsx')
    useSidebarUiStore.getState().clearRevealRequest()
    expect(useSidebarUiStore.getState().revealRequest).toBeNull()
  })
})
