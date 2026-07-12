import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGitStore } from '../gitStore'
import type { GitStatus, GitAheadBehind } from '@/types/index'

const emptyStatus: GitStatus = { staged: [], unstaged: [] }
const mockStatus: GitStatus = {
  staged: [{ path: 'a.ts', status: 'M' }],
  unstaged: [{ path: 'b.ts', status: '?' }],
}
const mockAheadBehind: GitAheadBehind = { ahead: 2, behind: 1 }

vi.stubGlobal('window', {
  api: {
    gitBranch: vi.fn().mockResolvedValue('main'),
    gitAheadBehind: vi.fn().mockResolvedValue(mockAheadBehind),
    gitStatus: vi.fn().mockResolvedValue(mockStatus),
    gitStage: vi.fn().mockResolvedValue(undefined),
    gitUnstage: vi.fn().mockResolvedValue(undefined),
    gitStageAll: vi.fn().mockResolvedValue(undefined),
    gitUnstageAll: vi.fn().mockResolvedValue(undefined),
    gitCommit: vi.fn().mockResolvedValue({ ok: true }),
  },
})

describe('gitStore', () => {
  beforeEach(() =>
    useGitStore.setState({
      branch: null,
      aheadBehind: null,
      status: emptyStatus,
      commitMessage: '',
      commitError: null,
    })
  )

  it('starts empty', () => {
    const { branch, aheadBehind, status, commitMessage, commitError } = useGitStore.getState()
    expect(branch).toBeNull()
    expect(aheadBehind).toBeNull()
    expect(status).toEqual(emptyStatus)
    expect(commitMessage).toBe('')
    expect(commitError).toBeNull()
  })

  it('refresh loads branch, ahead/behind counts, and status', async () => {
    await useGitStore.getState().refresh('/proj')
    const { branch, aheadBehind, status } = useGitStore.getState()
    expect(branch).toBe('main')
    expect(aheadBehind).toEqual(mockAheadBehind)
    expect(status).toEqual(mockStatus)
  })

  it('refresh with null cwd clears branch, ahead/behind, and status', async () => {
    useGitStore.setState({ branch: 'main', aheadBehind: mockAheadBehind, status: mockStatus })
    await useGitStore.getState().refresh(null)
    const { branch, aheadBehind, status } = useGitStore.getState()
    expect(branch).toBeNull()
    expect(aheadBehind).toBeNull()
    expect(status).toEqual(emptyStatus)
  })

  it('stage calls gitStage with the path and refreshes status', async () => {
    await useGitStore.getState().stage('/proj', 'a.ts')
    expect(window.api.gitStage).toHaveBeenCalledWith('/proj', ['a.ts'])
    expect(useGitStore.getState().status).toEqual(mockStatus)
  })

  it('unstage calls gitUnstage with the path and refreshes status', async () => {
    await useGitStore.getState().unstage('/proj', 'b.ts')
    expect(window.api.gitUnstage).toHaveBeenCalledWith('/proj', ['b.ts'])
  })

  it('stageAll calls gitStageAll and refreshes status', async () => {
    await useGitStore.getState().stageAll('/proj')
    expect(window.api.gitStageAll).toHaveBeenCalledWith('/proj')
  })

  it('unstageAll calls gitUnstageAll and refreshes status', async () => {
    await useGitStore.getState().unstageAll('/proj')
    expect(window.api.gitUnstageAll).toHaveBeenCalledWith('/proj')
  })

  it('stage does not throw and still refreshes status when gitStage rejects', async () => {
    vi.mocked(window.api.gitStage).mockRejectedValueOnce(new Error('boom'))
    await expect(useGitStore.getState().stage('/proj', 'a.ts')).resolves.toBeUndefined()
    expect(window.api.gitStatus).toHaveBeenCalledWith('/proj')
    expect(useGitStore.getState().status).toEqual(mockStatus)
  })

  it('unstage does not throw and still refreshes status when gitUnstage rejects', async () => {
    vi.mocked(window.api.gitUnstage).mockRejectedValueOnce(new Error('boom'))
    await expect(useGitStore.getState().unstage('/proj', 'b.ts')).resolves.toBeUndefined()
    expect(window.api.gitStatus).toHaveBeenCalledWith('/proj')
    expect(useGitStore.getState().status).toEqual(mockStatus)
  })

  it('stageAll does not throw and still refreshes status when gitStageAll rejects', async () => {
    vi.mocked(window.api.gitStageAll).mockRejectedValueOnce(new Error('boom'))
    await expect(useGitStore.getState().stageAll('/proj')).resolves.toBeUndefined()
    expect(window.api.gitStatus).toHaveBeenCalledWith('/proj')
    expect(useGitStore.getState().status).toEqual(mockStatus)
  })

  it('unstageAll does not throw and still refreshes status when gitUnstageAll rejects', async () => {
    vi.mocked(window.api.gitUnstageAll).mockRejectedValueOnce(new Error('boom'))
    await expect(useGitStore.getState().unstageAll('/proj')).resolves.toBeUndefined()
    expect(window.api.gitStatus).toHaveBeenCalledWith('/proj')
    expect(useGitStore.getState().status).toEqual(mockStatus)
  })

  it('setCommitMessage updates the message and clears any error', () => {
    useGitStore.setState({ commitError: 'boom' })
    useGitStore.getState().setCommitMessage('fix bug')
    const { commitMessage, commitError } = useGitStore.getState()
    expect(commitMessage).toBe('fix bug')
    expect(commitError).toBeNull()
  })

  it('commit clears the message and refreshes on success', async () => {
    useGitStore.setState({ commitMessage: 'fix bug' })
    await useGitStore.getState().commit('/proj')
    expect(window.api.gitCommit).toHaveBeenCalledWith('/proj', 'fix bug')
    const { commitMessage, commitError, status } = useGitStore.getState()
    expect(commitMessage).toBe('')
    expect(commitError).toBeNull()
    expect(status).toEqual(mockStatus)
  })

  it('commit sets commitError and keeps the message on failure', async () => {
    vi.mocked(window.api.gitCommit).mockResolvedValueOnce({ ok: false, error: 'nothing staged' })
    useGitStore.setState({ commitMessage: 'fix bug' })
    await useGitStore.getState().commit('/proj')
    const { commitMessage, commitError } = useGitStore.getState()
    expect(commitMessage).toBe('fix bug')
    expect(commitError).toBe('nothing staged')
  })
})
