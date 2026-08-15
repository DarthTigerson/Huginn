import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { GitPanel } from '../GitPanel'
import { useFileStore } from '@/stores/fileStore'
import { useGitStore } from '@/stores/gitStore'
import { useCommitMessageSettingsStore } from '@/stores/commitMessageSettingsStore'
import type { GitStatus } from '@/types/index'

const staged: GitStatus = {
  staged: [{ path: 'src/App.tsx', status: 'M' }],
  unstaged: [],
}
const nothingStaged: GitStatus = { staged: [], unstaged: [] }

beforeEach(() => {
  ;(global as any).window.api = {
    gitStatus: vi.fn().mockResolvedValue(staged),
    gitListIgnored: vi.fn().mockResolvedValue([]),
    gitStagedDiff: vi.fn().mockResolvedValue('diff --git a/x b/x'),
    commitMessageGenerate: vi.fn().mockResolvedValue('Fix the login bug'),
  }
  useFileStore.setState({ projectRoot: '/proj' })
  useGitStore.setState({
    status: staged,
    commandStatus: 'idle',
    commitMessage: '',
    commitError: null,
  })
  useCommitMessageSettingsStore.setState({ enabled: true, model: 'claude-sonnet-5', prompt: '' })
})

afterEach(() => {
  cleanup()
})

function generateButton() {
  return screen.getByTitle('Generate commit message from staged changes')
}

describe('GitPanel — generate commit message', () => {
  it('is hidden when the feature is disabled in settings', () => {
    useCommitMessageSettingsStore.setState({ enabled: false })
    render(<GitPanel />)
    expect(screen.queryByTitle('Generate commit message from staged changes')).toBeNull()
  })

  it('is disabled when nothing is staged', () => {
    useGitStore.setState({ status: nothingStaged })
    render(<GitPanel />)
    expect(generateButton()).toBeDisabled()
  })

  it('fetches the staged diff and fills the commit message on success', async () => {
    render(<GitPanel />)
    fireEvent.click(generateButton())

    await waitFor(() => expect(useGitStore.getState().commitMessage).toBe('Fix the login bug'))
    expect(window.api.gitStagedDiff).toHaveBeenCalledWith('/proj')
    expect(window.api.commitMessageGenerate).toHaveBeenCalledWith('diff --git a/x b/x', 'claude-sonnet-5', '')
  })

  it('passes the configured model and custom prompt through', async () => {
    useCommitMessageSettingsStore.setState({ model: 'claude-opus-5', prompt: 'Always mention the ticket number' })
    render(<GitPanel />)
    fireEvent.click(generateButton())

    await waitFor(() => expect(window.api.commitMessageGenerate).toHaveBeenCalled())
    expect(window.api.commitMessageGenerate).toHaveBeenCalledWith(
      'diff --git a/x b/x',
      'claude-opus-5',
      'Always mention the ticket number'
    )
  })

  it('overwrites an existing commit message rather than appending', async () => {
    useGitStore.setState({ commitMessage: 'wip' })
    render(<GitPanel />)
    fireEvent.click(generateButton())

    await waitFor(() => expect(useGitStore.getState().commitMessage).toBe('Fix the login bug'))
  })

  it('shows an error and leaves the message box alone when generation fails', async () => {
    ;(window.api.commitMessageGenerate as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    useGitStore.setState({ commitMessage: 'wip' })
    render(<GitPanel />)
    fireEvent.click(generateButton())

    await waitFor(() => expect(screen.getByText('Could not generate a commit message')).toBeTruthy())
    expect(useGitStore.getState().commitMessage).toBe('wip')
  })
})
