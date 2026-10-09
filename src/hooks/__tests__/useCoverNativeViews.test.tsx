/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useNativeViewCoverStore, useCoverNativeViews } from '@/lib/nativeViewCover'

beforeEach(() => useNativeViewCoverStore.setState({ count: 0 }))
afterEach(cleanup)

function Popup({ open = true }: { open?: boolean }) {
  useCoverNativeViews(open)
  return null
}

describe('nativeViewCover', () => {
  it('counts covers, and releasing twice only releases once', () => {
    const release = useNativeViewCoverStore.getState().cover()
    useNativeViewCoverStore.getState().cover()
    expect(useNativeViewCoverStore.getState().count).toBe(2)
    release()
    release()
    expect(useNativeViewCoverStore.getState().count).toBe(1)
  })

  it('covers while a popup is mounted and open, and uncovers when it closes or unmounts', () => {
    const { rerender, unmount } = render(<Popup />)
    expect(useNativeViewCoverStore.getState().count).toBe(1)
    rerender(<Popup open={false} />)
    expect(useNativeViewCoverStore.getState().count).toBe(0)
    rerender(<Popup open />)
    expect(useNativeViewCoverStore.getState().count).toBe(1)
    unmount()
    expect(useNativeViewCoverStore.getState().count).toBe(0)
  })
})
