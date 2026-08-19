import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { CommitFilterBar } from '../CommitFilterBar'
import { EMPTY_COMMIT_FILTERS } from '../commitFilter'
import type { GitCommit } from '@/types/index'

function commit(overrides: Partial<GitCommit>): GitCommit {
  return {
    hash: 'abc1234',
    parents: [],
    subject: 'Fix bug',
    author: 'Ada',
    date: '2026-01-01T00:00:00Z',
    refs: [],
    ...overrides,
  }
}

const commits = [
  commit({ hash: 'a', author: 'Ada', refs: ['main'] }),
  commit({ hash: 'b', author: 'Grace', refs: ['origin/feature-x', 'tag: v1.0'] }),
]

afterEach(() => {
  cleanup()
})

describe('CommitFilterBar', () => {
  it('calls onSearchTextChange as the search input changes', () => {
    const onSearchTextChange = vi.fn()
    render(
      <CommitFilterBar
        commits={commits}
        filters={EMPTY_COMMIT_FILTERS}
        onSearchTextChange={onSearchTextChange}
        onBranchesChange={vi.fn()}
        onTagsChange={vi.fn()}
        onAuthorsChange={vi.fn()}
      />
    )
    fireEvent.change(screen.getByPlaceholderText(/search subject/i), { target: { value: 'fix' } })
    expect(onSearchTextChange).toHaveBeenCalledWith('fix')
  })

  it('branch dropdown lists distinct branch names derived from the commits, excluding tags', () => {
    render(
      <CommitFilterBar
        commits={commits}
        filters={EMPTY_COMMIT_FILTERS}
        onSearchTextChange={vi.fn()}
        onBranchesChange={vi.fn()}
        onTagsChange={vi.fn()}
        onAuthorsChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Branch' }))
    expect(screen.getByText('main')).toBeTruthy()
    expect(screen.getByText('feature-x')).toBeTruthy()
    expect(screen.queryByText('v1.0')).toBeNull()
  })

  it('clicking a branch option calls onBranchesChange with it added', () => {
    const onBranchesChange = vi.fn()
    render(
      <CommitFilterBar
        commits={commits}
        filters={EMPTY_COMMIT_FILTERS}
        onSearchTextChange={vi.fn()}
        onBranchesChange={onBranchesChange}
        onTagsChange={vi.fn()}
        onAuthorsChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Branch' }))
    fireEvent.click(screen.getByText('main'))
    expect(onBranchesChange).toHaveBeenCalledWith(['main'])
  })

  it('clicking an already-selected option calls onChange with it removed', () => {
    const onAuthorsChange = vi.fn()
    render(
      <CommitFilterBar
        commits={commits}
        filters={{ ...EMPTY_COMMIT_FILTERS, authors: ['Ada'] }}
        onSearchTextChange={vi.fn()}
        onBranchesChange={vi.fn()}
        onTagsChange={vi.fn()}
        onAuthorsChange={onAuthorsChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Author1' }))
    fireEvent.click(screen.getByText('Ada'))
    expect(onAuthorsChange).toHaveBeenCalledWith([])
  })

  it('shows a selection count badge and a Clear button once something is selected', () => {
    render(
      <CommitFilterBar
        commits={commits}
        filters={{ ...EMPTY_COMMIT_FILTERS, tags: ['v1.0'] }}
        onSearchTextChange={vi.fn()}
        onBranchesChange={vi.fn()}
        onTagsChange={vi.fn()}
        onAuthorsChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Tag1' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tag1' }))
    expect(screen.getByText('Clear')).toBeTruthy()
  })

  it('Clear calls onChange with an empty array', () => {
    const onTagsChange = vi.fn()
    render(
      <CommitFilterBar
        commits={commits}
        filters={{ ...EMPTY_COMMIT_FILTERS, tags: ['v1.0'] }}
        onSearchTextChange={vi.fn()}
        onBranchesChange={vi.fn()}
        onTagsChange={onTagsChange}
        onAuthorsChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tag1' }))
    fireEvent.click(screen.getByText('Clear'))
    expect(onTagsChange).toHaveBeenCalledWith([])
  })

  it('disables a dropdown with no options', () => {
    render(
      <CommitFilterBar
        commits={[]}
        filters={EMPTY_COMMIT_FILTERS}
        onSearchTextChange={vi.fn()}
        onBranchesChange={vi.fn()}
        onTagsChange={vi.fn()}
        onAuthorsChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Branch' })).toBeDisabled()
  })
})
