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

function publishCommit() {
  useFooterBlameStore.setState({
    owner: {},
    blame: {
      kind: 'commit',
      author: 'Keith Fenech',
      summary: 'Add end-of-line git-blame annotations to the editor',
      date: '2026-09-14 10:22:05',
      relDate: '15d ago',
    },
  })
}

describe('StatusBar current-line blame', () => {
  it('shows nothing when no editor has published blame', () => {
    render(<StatusBar />)
    expect(screen.queryByTestId('footer-blame')).toBeNull()
  })

  it('shows the author and commit message, without the time', () => {
    publishCommit()
    render(<StatusBar />)
    const el = screen.getByTestId('footer-blame')
    expect(el).toHaveTextContent('Keith Fenech • Add end-of-line git-blame annotations to the editor')
    expect(el).not.toHaveTextContent('15d ago')
    expect(el).not.toHaveAttribute('title')
  })

  it('shows the author in the theme accent colour', () => {
    publishCommit()
    render(<StatusBar />)
    expect(screen.getByTestId('footer-blame').querySelector('.text-accent')).toHaveTextContent('Keith Fenech')
  })

  it('has a hover panel with the author, date and time, and full commit message', () => {
    publishCommit()
    render(<StatusBar />)
    const panel = screen.getByRole('tooltip', { name: /blame details/i })
    expect(panel).toHaveTextContent('Keith Fenech')
    expect(panel).toHaveTextContent('2026-09-14 10:22:05')
    expect(panel).toHaveTextContent('15d ago')
    expect(panel).toHaveTextContent('Add end-of-line git-blame annotations to the editor')
  })

  it('shows "Uncommitted change" with no hover panel for an uncommitted line', () => {
    useFooterBlameStore.setState({ owner: {}, blame: { kind: 'uncommitted' } })
    render(<StatusBar />)
    expect(screen.getByTestId('footer-blame')).toHaveTextContent('Uncommitted change')
    expect(screen.queryByRole('tooltip', { name: /blame details/i })).toBeNull()
  })

  it('disappears when the blame is cleared', () => {
    publishCommit()
    render(<StatusBar />)
    act(() => useFooterBlameStore.setState({ owner: null, blame: null }))
    expect(screen.queryByTestId('footer-blame')).toBeNull()
  })
})
