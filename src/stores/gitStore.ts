import { create } from 'zustand'
import type { GitStatus, GitAheadBehind, GitCommandAction } from '@/types/index'

interface GitStore {
  branch: string | null
  aheadBehind: GitAheadBehind | null
  status: GitStatus
  commitMessage: string
  commitError: string | null
  commandStatus: 'idle' | 'running'
  refresh: (cwd: string | null) => Promise<void>
  refreshStatus: (cwd: string | null) => Promise<void>
  stage: (cwd: string, path: string) => Promise<void>
  unstage: (cwd: string, path: string) => Promise<void>
  stageAll: (cwd: string) => Promise<void>
  unstageAll: (cwd: string) => Promise<void>
  setCommitMessage: (message: string) => void
  commit: (cwd: string) => Promise<void>
  fetch: (cwd: string) => Promise<void>
  pull: (cwd: string) => Promise<void>
  push: (cwd: string) => Promise<void>
  forcePush: (cwd: string) => Promise<void>
  forcePushLease: (cwd: string) => Promise<void>
}

export const useGitStore = create<GitStore>((set, get) => {
  const runCommand = async (cwd: string, action: GitCommandAction) => {
    if (get().commandStatus === 'running') return
    const id = crypto.randomUUID()

    set({ commandStatus: 'running' })

    const cleanupData = window.api.onGitLogData(async (evtId, data) => {
      if (evtId !== id) return
      const { useGitLogStore } = await import('./gitLogStore')
      useGitLogStore.getState().append(data)
    })
    const cleanupExit = window.api.onGitLogExit(async (evtId, code) => {
      if (evtId !== id) return
      cleanupData()
      cleanupExit()
      set({ commandStatus: 'idle' })
      if (code === 0) get().refresh(cwd)
    })

    // Open/focus the git log tab and append a header line (async, non-blocking)
    import('./editorStore').then(({ useEditorStore }) => {
      useEditorStore.getState().openTab({ path: 'git-log://Git Log', content: '', dirty: false })
    })
    import('./gitLogStore').then(({ useGitLogStore }) => {
      useGitLogStore.getState().append(`\n> git ${action === 'forcePush' ? 'push --force' : action === 'forcePushLease' ? 'push --force-with-lease' : action}\n`)
    })

    await window.api.gitRunCommand(id, cwd, action)
  }

  return {
  branch: null,
  aheadBehind: null,
  status: { staged: [], unstaged: [] },
  commitMessage: '',
  commitError: null,
  commandStatus: 'idle' as const,

  refresh: async (cwd) => {
    if (!cwd) {
      set({ branch: null, aheadBehind: null, status: { staged: [], unstaged: [] } })
      return
    }
    const [branch, aheadBehind] = await Promise.all([
      window.api.gitBranch(cwd),
      window.api.gitAheadBehind(cwd),
    ])
    set({ branch, aheadBehind })
    await get().refreshStatus(cwd)
  },

  refreshStatus: async (cwd) => {
    if (!cwd) {
      set({ status: { staged: [], unstaged: [] } })
      return
    }
    const status = await window.api.gitStatus(cwd)
    set({ status })
  },

  stage: async (cwd, path) => {
    try {
      await window.api.gitStage(cwd, [path])
    } catch (err) {
      console.error('git stage failed', err)
    } finally {
      await get().refreshStatus(cwd)
    }
  },

  unstage: async (cwd, path) => {
    try {
      await window.api.gitUnstage(cwd, [path])
    } catch (err) {
      console.error('git unstage failed', err)
    } finally {
      await get().refreshStatus(cwd)
    }
  },

  stageAll: async (cwd) => {
    try {
      await window.api.gitStageAll(cwd)
    } catch (err) {
      console.error('git stageAll failed', err)
    } finally {
      await get().refreshStatus(cwd)
    }
  },

  unstageAll: async (cwd) => {
    try {
      await window.api.gitUnstageAll(cwd)
    } catch (err) {
      console.error('git unstageAll failed', err)
    } finally {
      await get().refreshStatus(cwd)
    }
  },

  setCommitMessage: (message) => set({ commitMessage: message, commitError: null }),

  commit: async (cwd) => {
    const { commitMessage } = get()
    const result = await window.api.gitCommit(cwd, commitMessage)
    if (result.ok) {
      set({ commitMessage: '', commitError: null })
      await get().refresh(cwd)
    } else {
      set({ commitError: result.error })
    }
  },

  fetch:          (cwd) => runCommand(cwd, 'fetch'),
  pull:           (cwd) => runCommand(cwd, 'pull'),
  push:           (cwd) => runCommand(cwd, 'push'),
  forcePush:      (cwd) => runCommand(cwd, 'forcePush'),
  forcePushLease: (cwd) => runCommand(cwd, 'forcePushLease'),
  }
})
