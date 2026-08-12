import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGitStore } from '../gitStore'
import type { GitStatus, GitAheadBehind } from '@/types/index'

const editorStoreMock = vi.hoisted(() => ({
  tabs: [] as Array<{ path: string; content: string; dirty: boolean }>,
  openTab: vi.fn(),
}))
const gitGraphLoadMock = vi.hoisted(() => vi.fn())
const gitBranchLoadMock = vi.hoisted(() => vi.fn())

vi.mock('@/stores/editorStore', () => ({
  useEditorStore: {
    getState: () => ({
      tabs: editorStoreMock.tabs,
      openTab: editorStoreMock.openTab,
    }),
  },
}))
vi.mock('@/stores/gitLogStore', () => ({ useGitLogStore: { getState: () => ({ append: vi.fn() }) } }))
vi.mock('@/stores/gitGraphStore', () => ({
  useGitGraphStore: { getState: () => ({ load: gitGraphLoadMock }) },
}))
vi.mock('@/stores/gitBranchStore', () => ({
  useGitBranchStore: { getState: () => ({ load: gitBranchLoadMock }) },
}))

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
    gitListIgnored: vi.fn().mockResolvedValue(['node_modules', 'dist']),
    gitStage: vi.fn().mockResolvedValue(undefined),
    gitUnstage: vi.fn().mockResolvedValue(undefined),
    gitStageAll: vi.fn().mockResolvedValue(undefined),
    gitUnstageAll: vi.fn().mockResolvedValue(undefined),
    gitCommit: vi.fn().mockResolvedValue({ ok: true }),
    gitRunCommand: vi.fn().mockResolvedValue(undefined),
    onGitLogData: vi.fn().mockReturnValue(() => {}),
    onGitLogExit: vi.fn().mockReturnValue(() => {}),
    gitFetchSilent: vi.fn().mockResolvedValue(true),
  },
})

describe('gitStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    editorStoreMock.tabs = []
    useGitStore.setState({
      branch: null,
      aheadBehind: null,
      status: emptyStatus,
      ignoredPaths: [],
      commitMessage: '',
      commitError: null,
      commandStatus: 'idle',
      silentFetchInFlight: false,
    })
  })

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

  it('refreshStatus loads ignored paths alongside status', async () => {
    await useGitStore.getState().refreshStatus('/proj')
    expect(window.api.gitListIgnored).toHaveBeenCalledWith('/proj')
    expect(useGitStore.getState().ignoredPaths).toEqual(['node_modules', 'dist'])
  })

  it('refreshStatus with null cwd clears ignored paths', async () => {
    useGitStore.setState({ ignoredPaths: ['node_modules'] })
    await useGitStore.getState().refreshStatus(null)
    expect(useGitStore.getState().ignoredPaths).toEqual([])
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

  it('commit refreshes the git graph when the graph tab is open', async () => {
    editorStoreMock.tabs = [{ path: 'git-graph://Graph', content: '', dirty: false }]
    useGitStore.setState({ commitMessage: 'fix bug' })

    await useGitStore.getState().commit('/proj')

    expect(gitGraphLoadMock).toHaveBeenCalledWith('/proj')
  })

  it('commit does not refresh the git graph when the graph tab is closed', async () => {
    editorStoreMock.tabs = [{ path: 'git-log://Git Log', content: '', dirty: false }]
    useGitStore.setState({ commitMessage: 'fix bug' })

    await useGitStore.getState().commit('/proj')

    expect(gitGraphLoadMock).not.toHaveBeenCalled()
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

describe('gitStore — command actions', () => {
  beforeEach(() => {
    useGitStore.setState({
      branch: 'main',
      aheadBehind: null,
      status: emptyStatus,
      commitMessage: '',
      commitError: null,
      commandStatus: 'idle',
    })
    vi.mocked(window.api.gitRunCommand).mockClear()
    gitBranchLoadMock.mockClear()
    vi.mocked(window.api.onGitLogData).mockClear()
    vi.mocked(window.api.onGitLogExit).mockClear()
    vi.mocked(window.api.gitBranch).mockClear()
    vi.mocked(window.api.gitFetchSilent).mockClear()
    // Stub crypto.randomUUID so we know the id used internally
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('test-uuid' as `${string}-${string}-${string}-${string}-${string}`)
  })

  it('sets commandStatus to running and calls gitRunCommand for push', async () => {
    const pushPromise = useGitStore.getState().push('/proj')
    expect(useGitStore.getState().commandStatus).toBe('running')
    expect(window.api.gitRunCommand).toHaveBeenCalledWith(
      expect.any(String), '/proj', 'push'
    )
    await pushPromise
  })

  it('does nothing if commandStatus is already running', async () => {
    useGitStore.setState({ commandStatus: 'running' })
    await useGitStore.getState().push('/proj')
    expect(window.api.gitRunCommand).not.toHaveBeenCalled()
  })

  it('calls gitRunCommand with forcePush for forcePush action', async () => {
    await useGitStore.getState().forcePush('/proj')
    expect(window.api.gitRunCommand).toHaveBeenCalledWith(
      expect.any(String), '/proj', 'forcePush'
    )
  })

  it('calls gitRunCommand with forcePushLease for forcePushLease action', async () => {
    await useGitStore.getState().forcePushLease('/proj')
    expect(window.api.gitRunCommand).toHaveBeenCalledWith(
      expect.any(String), '/proj', 'forcePushLease'
    )
  })

  it('sets commandStatus back to idle when exit fires with code 0 and calls refresh', async () => {
    let exitCb: ((id: string, code: number) => void) | null = null
    vi.mocked(window.api.onGitLogExit).mockImplementation((cb) => {
      exitCb = cb
      return () => {}
    })
    const pushPromise = useGitStore.getState().push('/proj')
    await pushPromise
    exitCb!('test-uuid', 0)
    expect(useGitStore.getState().commandStatus).toBe('idle')
    expect(window.api.gitBranch).toHaveBeenCalled()
  })

  it('sets commandStatus back to idle when exit fires with non-zero code and does NOT call refresh', async () => {
    let exitCb: ((id: string, code: number) => void) | null = null
    vi.mocked(window.api.onGitLogExit).mockImplementation((cb) => {
      exitCb = cb
      return () => {}
    })
    const pushPromise = useGitStore.getState().push('/proj')
    await pushPromise
    exitCb!('test-uuid', 1)
    expect(useGitStore.getState().commandStatus).toBe('idle')
    expect(window.api.gitBranch).not.toHaveBeenCalled()
  })

  it('checkout calls gitRunCommand with the checkout action and payload', async () => {
    const payload = { ref: 'feature-x', create: false }
    await useGitStore.getState().checkout('/proj', payload)
    expect(window.api.gitRunCommand).toHaveBeenCalledWith(
      expect.any(String), '/proj', 'checkout', payload
    )
  })

  it('checkout with create+track passes the full payload through', async () => {
    const payload = { ref: 'feat/x', create: true, track: 'origin/feat/x' }
    await useGitStore.getState().checkout('/proj', payload)
    expect(window.api.gitRunCommand).toHaveBeenCalledWith(
      expect.any(String), '/proj', 'checkout', payload
    )
  })

  it('checkout reloads the branch list on successful exit', async () => {
    let exitCb: ((id: string, code: number) => void) | null = null
    vi.mocked(window.api.onGitLogExit).mockImplementation((cb) => {
      exitCb = cb
      return () => {}
    })
    const checkoutPromise = useGitStore.getState().checkout('/proj', { ref: 'feature-x', create: false })
    await checkoutPromise
    exitCb!('test-uuid', 0)
    expect(gitBranchLoadMock).toHaveBeenCalledWith('/proj')
  })

  it('checkout does NOT reload the branch list on failed exit', async () => {
    let exitCb: ((id: string, code: number) => void) | null = null
    vi.mocked(window.api.onGitLogExit).mockImplementation((cb) => {
      exitCb = cb
      return () => {}
    })
    const checkoutPromise = useGitStore.getState().checkout('/proj', { ref: 'feature-x', create: false })
    await checkoutPromise
    exitCb!('test-uuid', 1)
    expect(gitBranchLoadMock).not.toHaveBeenCalled()
  })

  it('checkout triggers a silent fetch on successful exit', async () => {
    let exitCb: ((id: string, code: number) => void) | null = null
    vi.mocked(window.api.onGitLogExit).mockImplementation((cb) => {
      exitCb = cb
      return () => {}
    })
    const checkoutPromise = useGitStore.getState().checkout('/proj', { ref: 'feature-x', create: false })
    await checkoutPromise
    exitCb!('test-uuid', 0)
    expect(window.api.gitFetchSilent).toHaveBeenCalledWith('/proj')
  })

  it('checkout does NOT trigger a silent fetch on failed exit', async () => {
    let exitCb: ((id: string, code: number) => void) | null = null
    vi.mocked(window.api.onGitLogExit).mockImplementation((cb) => {
      exitCb = cb
      return () => {}
    })
    const checkoutPromise = useGitStore.getState().checkout('/proj', { ref: 'feature-x', create: false })
    await checkoutPromise
    exitCb!('test-uuid', 1)
    expect(window.api.gitFetchSilent).not.toHaveBeenCalled()
  })
})

describe('gitStore — fetchSilent', () => {
  beforeEach(() => {
    useGitStore.setState({
      branch: 'main',
      aheadBehind: null,
      status: emptyStatus,
      commandStatus: 'idle',
      silentFetchInFlight: false,
    })
    vi.mocked(window.api.gitFetchSilent).mockClear().mockResolvedValue(true)
    vi.mocked(window.api.gitBranch).mockClear()
  })

  it('sets silentFetchInFlight while running and clears it after', async () => {
    let resolveFetch: (v: boolean) => void = () => {}
    vi.mocked(window.api.gitFetchSilent).mockReturnValueOnce(
      new Promise((resolve) => { resolveFetch = resolve })
    )
    const fetchPromise = useGitStore.getState().fetchSilent('/proj')
    expect(useGitStore.getState().silentFetchInFlight).toBe(true)
    resolveFetch(true)
    await fetchPromise
    expect(useGitStore.getState().silentFetchInFlight).toBe(false)
  })

  it('refreshes branch/status when the fetch succeeds', async () => {
    await useGitStore.getState().fetchSilent('/proj')
    expect(window.api.gitBranch).toHaveBeenCalledWith('/proj')
  })

  it('does not refresh when the fetch fails', async () => {
    vi.mocked(window.api.gitFetchSilent).mockResolvedValueOnce(false)
    await useGitStore.getState().fetchSilent('/proj')
    expect(window.api.gitBranch).not.toHaveBeenCalled()
  })

  it('does nothing if a visible git command is already running', async () => {
    useGitStore.setState({ commandStatus: 'running' })
    await useGitStore.getState().fetchSilent('/proj')
    expect(window.api.gitFetchSilent).not.toHaveBeenCalled()
  })

  it('does nothing if a silent fetch is already in flight', async () => {
    useGitStore.setState({ silentFetchInFlight: true })
    await useGitStore.getState().fetchSilent('/proj')
    expect(window.api.gitFetchSilent).not.toHaveBeenCalled()
  })
})
