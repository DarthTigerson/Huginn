import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MarkdownViewer } from '../MarkdownViewer'

beforeEach(() => {
  ;(global as any).window.api = {
    readFile: vi.fn(async () => '# Hello\n\nSome **bold** text.'),
  }
})

afterEach(() => {
  cleanup()
})

describe('MarkdownViewer', () => {
  it('renders markdown content as HTML', async () => {
    render(<MarkdownViewer path="/proj/README.md" />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hello' })).toBeTruthy())
    expect(screen.getByText('bold').tagName).toBe('STRONG')
  })

  it('shows an error message when the file fails to load', async () => {
    ;(window as any).api.readFile = vi.fn(async () => {
      throw new Error('nope')
    })
    render(<MarkdownViewer path="/proj/README.md" />)
    await waitFor(() => expect(screen.getByText(/Couldn't load README.md/)).toBeTruthy())
  })
})
