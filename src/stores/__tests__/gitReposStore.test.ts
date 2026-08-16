import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGitReposStore } from '../gitReposStore'
import { useGitStore, emptyRepoGitState } from '../gitStore'

const showMock = vi.hoisted(() => vi.fn())
vi.mock('@/stores/statusMessageStore', () => ({
  useStatusMessageStore: { getState: () => ({ show: showMock }) },
}))

describe('gitReposStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGitReposStore.setState({ repos: [], selectedRepo: null })
    useGitStore.setState({ repos: {} })
  })

  it('starts with no repos and no selection', () => {
    const { repos, selectedRepo } = useGitReposStore.getState()
    expect(repos).toEqual([])
    expect(selectedRepo).toBeNull()
  })

  it('setRepos with a single repo auto-selects it', () => {
    useGitReposStore.getState().setRepos(['/proj'])
    expect(useGitReposStore.getState().selectedRepo).toBe('/proj')
  })

  it('setRepos with multiple repos selects the first, sorted, one', () => {
    useGitReposStore.getState().setRepos(['/parent/repoB', '/parent/repoA'])
    expect(useGitReposStore.getState().selectedRepo).toBe('/parent/repoB')
  })

  it('setRepos preserves the current selection if it is still in the new list', () => {
    useGitReposStore.setState({ repos: ['/repoA', '/repoB'], selectedRepo: '/repoB' })
    useGitReposStore.getState().setRepos(['/repoA', '/repoB'])
    expect(useGitReposStore.getState().selectedRepo).toBe('/repoB')
  })

  it('setRepos falls back to the first repo if the current selection is gone', () => {
    useGitReposStore.setState({ repos: ['/repoA', '/repoB'], selectedRepo: '/repoB' })
    useGitReposStore.getState().setRepos(['/repoA', '/repoC'])
    expect(useGitReposStore.getState().selectedRepo).toBe('/repoA')
  })

  it('setRepos with an empty list clears the selection', () => {
    useGitReposStore.setState({ repos: ['/repoA'], selectedRepo: '/repoA' })
    useGitReposStore.getState().setRepos([])
    expect(useGitReposStore.getState().selectedRepo).toBeNull()
  })

  it('selectRepo sets the selection directly', () => {
    useGitReposStore.setState({ repos: ['/repoA', '/repoB'] })
    useGitReposStore.getState().selectRepo('/repoB')
    expect(useGitReposStore.getState().selectedRepo).toBe('/repoB')
  })

  it('resolveRepoForPath matches the containing repo by longest prefix', () => {
    useGitReposStore.setState({ repos: ['/parent/repoA', '/parent/repoA-longer'] })
    expect(useGitReposStore.getState().resolveRepoForPath('/parent/repoA-longer/src/x.ts')).toBe('/parent/repoA-longer')
    expect(useGitReposStore.getState().resolveRepoForPath('/parent/repoA/src/x.ts')).toBe('/parent/repoA')
  })

  it('resolveRepoForPath returns the repo itself for an exact match', () => {
    useGitReposStore.setState({ repos: ['/parent/repoA'] })
    expect(useGitReposStore.getState().resolveRepoForPath('/parent/repoA')).toBe('/parent/repoA')
  })

  it('resolveRepoForPath returns null when no repo contains the path', () => {
    useGitReposStore.setState({ repos: ['/parent/repoA'] })
    expect(useGitReposStore.getState().resolveRepoForPath('/elsewhere/file.ts')).toBeNull()
  })

  it('followFilePath switches selectedRepo and shows a notice when the file is in a different repo', () => {
    useGitReposStore.setState({ repos: ['/parent/repoA', '/parent/repoB'], selectedRepo: '/parent/repoA' })
    useGitStore.setState({ repos: { '/parent/repoB': { ...emptyRepoGitState, branch: 'main' } } })

    useGitReposStore.getState().followFilePath('/parent/repoB/src/x.ts')

    expect(useGitReposStore.getState().selectedRepo).toBe('/parent/repoB')
    expect(showMock).toHaveBeenCalledWith('Switched to repoB on main')
  })

  it('followFilePath omits the branch clause when the branch is not yet known', () => {
    useGitReposStore.setState({ repos: ['/parent/repoA', '/parent/repoB'], selectedRepo: '/parent/repoA' })

    useGitReposStore.getState().followFilePath('/parent/repoB/src/x.ts')

    expect(showMock).toHaveBeenCalledWith('Switched to repoB')
  })

  it('followFilePath does nothing when the file is already in the selected repo', () => {
    useGitReposStore.setState({ repos: ['/parent/repoA'], selectedRepo: '/parent/repoA' })
    useGitReposStore.getState().followFilePath('/parent/repoA/src/x.ts')
    expect(showMock).not.toHaveBeenCalled()
  })

  it('followFilePath does nothing when the path is outside every known repo', () => {
    useGitReposStore.setState({ repos: ['/parent/repoA'], selectedRepo: '/parent/repoA' })
    useGitReposStore.getState().followFilePath('/elsewhere/file.ts')
    expect(useGitReposStore.getState().selectedRepo).toBe('/parent/repoA')
    expect(showMock).not.toHaveBeenCalled()
  })
})
