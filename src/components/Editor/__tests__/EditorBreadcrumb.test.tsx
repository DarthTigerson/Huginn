import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorBreadcrumb } from '../EditorBreadcrumb'

describe('EditorBreadcrumb', () => {
  it('renders path segments relative to the project root, filename last and highlighted', () => {
    render(<EditorBreadcrumb path="/repo/src/components/Foo.tsx" projectRoot="/repo" />)
    expect(screen.getByText('src')).toBeTruthy()
    expect(screen.getByText('components')).toBeTruthy()
    const filename = screen.getByText('Foo.tsx')
    expect(filename.className).toContain('text-fg')
  })

  it('falls back to the absolute path when there is no project root', () => {
    render(<EditorBreadcrumb path="/repo/src/Foo.tsx" projectRoot={null} />)
    expect(screen.getByText('repo')).toBeTruthy()
    expect(screen.getByText('Foo.tsx')).toBeTruthy()
  })

  it('renders just the filename for a root-level file', () => {
    render(<EditorBreadcrumb path="/repo/README.md" projectRoot="/repo" />)
    expect(screen.getByText('README.md')).toBeTruthy()
  })
})
