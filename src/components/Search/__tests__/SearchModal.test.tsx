import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchModal } from '../SearchModal'
import { useEditorStore } from '@/stores/editorStore'

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  ;(global as any).window.api = {
    searchText: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
  }
  useEditorStore.setState({
    tabs: [{ path: '/proj/current.ts', content: 'let ABC = 1\nlet abc = 2', dirty: false }],
    activePaneId: 'pane-1',
    paneTabs: { 'pane-1': '/proj/current.ts' },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SearchModal case-sensitivity toggle', () => {
  it('defaults to case-insensitive', () => {
    render(<SearchModal projectRoot="/proj" onClose={() => {}} />)
    const toggle = screen.getByTitle(/click for case-sensitive/i)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('toggles to case-sensitive on click and back on a second click', async () => {
    const user = userEvent.setup()
    render(<SearchModal projectRoot="/proj" onClose={() => {}} />)
    const toggle = screen.getByTitle(/click for case-sensitive/i)

    await user.click(toggle)
    expect(screen.getByTitle(/click for case-insensitive/i).getAttribute('aria-pressed')).toBe('true')

    await user.click(screen.getByTitle(/click for case-insensitive/i))
    expect(screen.getByTitle(/click for case-sensitive/i).getAttribute('aria-pressed')).toBe('false')
  })

  it('case-insensitive (default) matches both ABC and abc in the current file', async () => {
    render(<SearchModal projectRoot="/proj" onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/Search text/i), { target: { value: 'abc' } })
    await waitFor(() => expect(screen.getByText('2 matches in 1 file')).toBeTruthy())
  })

  it('case-sensitive (after toggle) only matches the exact case in the current file', async () => {
    const user = userEvent.setup()
    render(<SearchModal projectRoot="/proj" onClose={() => {}} />)
    await user.click(screen.getByTitle(/click for case-sensitive/i))

    fireEvent.change(screen.getByPlaceholderText(/Search text/i), { target: { value: 'abc' } })
    await waitFor(() => expect(screen.getByText('1 match in 1 file')).toBeTruthy())
  })
})
