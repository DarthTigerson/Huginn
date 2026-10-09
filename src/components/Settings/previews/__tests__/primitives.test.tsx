/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PreviewFrame, MiniCode, MiniFooter, MiniTabs, MiniPanes } from '../primitives'

afterEach(cleanup)

describe('preview primitives', () => {
  it('frames content with an optional caption and test id', () => {
    render(<PreviewFrame caption="Footer" testId="p"><span>inside</span></PreviewFrame>)
    expect(screen.getByTestId('p')).toHaveTextContent('Footer')
    expect(screen.getByText('inside')).toBeInTheDocument()
  })

  it('draws numbered code lines with per-line classes and trailing content', () => {
    const { container } = render(
      <MiniCode lines={[
        { n: 7, segments: [{ text: 'const', token: 'keyword' }, { text: ' x' }], lineClassName: 'git-line-added', numberClassName: 'git-gutter-added' },
        { n: 8, segments: [{ text: 'y', className: 'git-inline-diff-modified' }], trailing: <span>blame</span> },
      ]} />
    )
    expect(screen.getByText('7')).toHaveClass('git-gutter-added')
    expect(container.querySelector('.git-line-added')).not.toBeNull()
    expect(screen.getByText('y')).toHaveClass('git-inline-diff-modified')
    expect(screen.getByText('blame')).toBeInTheDocument()
  })

  it('draws a footer, tabs and split panes', () => {
    render(
      <>
        <MiniFooter left="develop ↓2" right="fetched" />
        <MiniTabs tabs={[{ label: 'Git Log', active: true }, { label: 'Editor.tsx', dot: true }]} />
        <MiniPanes panes={[{ grow: 1, focused: true, tabs: [{ label: 'App.tsx' }] }, { grow: 2, tabs: [{ label: 'Graph', isNew: true }] }]} />
      </>
    )
    expect(screen.getByText('develop ↓2')).toBeInTheDocument()
    expect(screen.getByText('Git Log')).toHaveAttribute('data-active', 'true')
    expect(screen.getByText('Graph')).toHaveAttribute('data-new', 'true')
    expect(screen.getByText('focused')).toBeInTheDocument()
  })
})
