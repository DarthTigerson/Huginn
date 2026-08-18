import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { GitPanel } from '../GitPanel'
import { useFileStore } from '@/stores/fileStore'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useGitStore, emptyRepoGitState } from '@/stores/gitStore'
import type { GitStatus } from '@/types/index'

const staged: GitStatus = {
  staged: [{ path: 'src/App.tsx', status: 'M' }],
  unstaged: [],
}

beforeEach(() => {
  ;(global as any).window.api = {
    gitStatus: vi.fn().mockResolvedValue(staged),
    gitListIgnored: vi.fn().mockResolvedValue([]),
    gitCommit: vi.fn().mockResolvedValue({ ok: true }),
    gitBranch: vi.fn().mockResolvedValue('main'),
    gitAheadBehind: vi.fn().mockResolvedValue(null),
  }
  useFileStore.setState({ projectRoot: '/proj' })
  useGitReposStore.setState({ repos: ['/proj'], selectedRepo: '/proj' })
  useGitStore.setState({
    repos: {
      '/proj': { ...emptyRepoGitState, status: staged, commitMessage: 'fix bug' },
    },
  })
})

afterEach(() => {
  cleanup()
})

describe('GitPanel — commit options (--no-verify)', () => {
  it('the options panel is closed by default', () => {
    render(<GitPanel />)
    expect(screen.queryByText('Commit --no-verify')).toBeNull()
  })

  it('clicking the options chevron opens a panel with a one-click "Commit --no-verify" button', () => {
    render(<GitPanel />)
    fireEvent.click(screen.getByLabelText('Commit options'))
    expect(screen.getByText('Commit --no-verify')).toBeTruthy()
  })

  it('clicking "Commit --no-verify" commits immediately with the flag and closes the panel', async () => {
    render(<GitPanel />)
    fireEvent.click(screen.getByLabelText('Commit options'))
    fireEvent.click(screen.getByText('Commit --no-verify'))

    await waitFor(() => expect(window.api.gitCommit).toHaveBeenCalledWith('/proj', 'fix bug', true))
    expect(screen.queryByText('Commit --no-verify')).toBeNull()
  })

  it('the plain Commit button still commits without the flag', async () => {
    render(<GitPanel />)
    fireEvent.click(screen.getByText('Commit'))

    await waitFor(() => expect(window.api.gitCommit).toHaveBeenCalledWith('/proj', 'fix bug', undefined))
  })

  it('clicking outside the panel closes it without committing', () => {
    render(<GitPanel />)
    fireEvent.click(screen.getByLabelText('Commit options'))
    expect(screen.getByText('Commit --no-verify')).toBeTruthy()

    fireEvent.pointerDown(document.body)

    expect(screen.queryByText('Commit --no-verify')).toBeNull()
    expect(window.api.gitCommit).not.toHaveBeenCalled()
  })

  it('the options chevron is disabled along with the main Commit button when there is nothing to commit', () => {
    useGitStore.setState({ repos: { '/proj': { ...emptyRepoGitState, status: staged, commitMessage: '' } } })
    render(<GitPanel />)

    expect(screen.getByText('Commit')).toBeDisabled()
    expect(screen.getByLabelText('Commit options')).toBeDisabled()
  })
})
