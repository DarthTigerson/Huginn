/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { StatusBar } from '../StatusBar'
import { useFooterBlameStore } from '@/stores/footerBlameStore'

beforeEach(() => {
  ;(global as any).window.api = {
    gitBranch: async () => null,
    gitAheadBehind: async () => null,
  }
})

afterEach(() => {
  cleanup()
  useFooterBlameStore.setState({ blame: null, owner: null })
})

describe('StatusBar current-line blame', () => {
  it('shows nothing when no editor has published blame', () => {
    render(<StatusBar />)
    expect(screen.queryByTestId('footer-blame')).toBeNull()
  })

  it('shows the published blame with the full details on hover', () => {
    useFooterBlameStore.setState({
      owner: {},
      blame: { text: 'Keith Fenech, 3 days ago • Add blame', hover: 'Add blame\nKeith Fenech — 26 Sep 2026\nadde1f5' },
    })
    render(<StatusBar />)
    const el = screen.getByTestId('footer-blame')
    expect(el).toHaveTextContent('Keith Fenech, 3 days ago • Add blame')
    expect(el).toHaveAttribute('title', 'Add blame\nKeith Fenech — 26 Sep 2026\nadde1f5')
  })

  it('shows the author name brighter than the rest of the line', () => {
    useFooterBlameStore.setState({
      owner: {},
      blame: { text: 'Keith Fenech, 3 days ago • Add blame', hover: '', author: 'Keith Fenech' },
    })
    render(<StatusBar />)
    expect(screen.getByText('Keith Fenech')).toHaveClass('text-fg-muted')
    expect(screen.getByTestId('footer-blame')).toHaveTextContent('Keith Fenech, 3 days ago • Add blame')
  })

  it('disappears when the blame is cleared', () => {
    useFooterBlameStore.setState({ owner: {}, blame: { text: 'Ada, now • x', hover: '' } })
    render(<StatusBar />)
    act(() => useFooterBlameStore.setState({ owner: null, blame: null }))
    expect(screen.queryByTestId('footer-blame')).toBeNull()
  })
})
