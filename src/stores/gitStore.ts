import { create } from 'zustand'
import type { GitStatus, GitAheadBehind, GitCommandAction, GitCheckoutPayload } from '@/types/index'
import { useEditorStore } from './editorStore'
import { useGitLogStore } from './gitLogStore'
import { useGitGraphStore } from './gitGraphStore'
import { useGitBranchStore } from './gitBranchStore'
import { GIT_GRAPH_TAB_PATH } from '@/components/Settings/paths'

interface GitStore {
  branch: string | null
  aheadBehind: GitAheadBehind | null
  status: GitStatus
  ignoredPaths: string[]
  commitMessage: string
  commitError: string | null
  commandStatus: 'idle' | 'running'
  refresh: (cwd: string | null) => Promise<void>
  refreshStatus: (cwd: string | null) => Promise<void>
  stage: (cwd: string, path: string) => Promise<void>
  unstage: (cwd: string, path: string) => Promise<void>
  stageAll: (cwd: string) => Promise<void>
  unstageAll: (cwd: string) => Promise<void>
  discard: (cwd: string, path: string) => Promise<void>
  setCommitMessage: (message: string) => void
  commit: (cwd: string) => Promise<void>
  fetch: (cwd: string) => Promise<void>
  pull: (cwd: string) => Promise<void>
  push: (cwd: string) => Promise<void>
  forcePush: (cwd: string) => Promise<void>
  forcePushLease: (cwd: string) => Promise<void>
  checkout: (cwd: string, payload: GitCheckoutPayload) => Promise<void>
}

function describeCommand(action: GitCommandAction, payload?: GitCheckoutPayload): string {
  if (action === 'forcePush') return 'push --force'
  if (action === 'forcePushLease') return 'push --force-with-lease'
  if (action === 'checkout' && payload) {
    if (payload.track) return `checkout -b ${payload.ref} --track ${payload.track}`
    if (payload.create) return `checkout -b ${payload.ref}`
    return `checkout ${payload.ref}`
  }
  return action
}

export const useGitStore = create<GitStore>((set, get) => {
  const refreshGraphIfOpen = async (cwd: string) => {
    const graphOpen = useEditorStore.getState().tabs.some((tab) => tab.path === GIT_GRAPH_TAB_PATH)
    if (graphOpen) await useGitGraphStore.getState().load(cwd)
  }

  const runCommand = async (cwd: string, action: GitCommandAction, payload?: GitCheckoutPayload) => {
    if (get().commandStatus === 'running') return
    const id = crypto.randomUUID()

    useEditorStore.getState().openTab({ path: 'git-log://Git Log', content: '', dirty: false })
    useGitLogStore.getState().append(`\n> git ${describeCommand(action, payload)}\n`)

    set({ commandStatus: 'running' })

    const cleanupData = window.api.onGitLogData((evtId, data) => {
      if (evtId !== id) return
      useGitLogStore.getState().append(data)
    })
    const cleanupExit = window.api.onGitLogExit((evtId, code) => {
      if (evtId !== id) return
      cleanupData()
      cleanupExit()
      set({ commandStatus: 'idle' })
      if (code === 0) {
        get().refresh(cwd)
        if (action === 'checkout') useGitBranchStore.getState().load(cwd)
      }
    })

    try {
      if (payload !== undefined) {
        await window.api.gitRunCommand(id, cwd, action, payload)
      } else {
        await window.api.gitRunCommand(id, cwd, action)
      }
    } catch (err) {
      cleanupData()
      cleanupExit()
      useGitLogStore.getState().append(`\nError: ${err instanceof Error ? err.message : String(err)}\n`)
      set({ commandStatus: 'idle' })
    }
  }

  return {
  branch: null,
  aheadBehind: null,
  status: { staged: [], unstaged: [] },
  ignoredPaths: [],
  commitMessage: '',
  commitError: null,
  commandStatus: 'idle' as const,

  refresh: async (cwd) => {
    if (!cwd) {
      set({ branch: null, aheadBehind: null, status: { staged: [], unstaged: [] }, ignoredPaths: [] })
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
      set({ status: { staged: [], unstaged: [] }, ignoredPaths: [] })
      return
    }
    const [status, ignoredPaths] = await Promise.all([
      window.api.gitStatus(cwd),
      window.api.gitListIgnored(cwd),
    ])
    set({ status, ignoredPaths })
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

  discard: async (cwd, path) => {
    try {
      await window.api.gitDiscard(cwd, path)
    } catch (err) {
      console.error('git discard failed', err)
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
      await refreshGraphIfOpen(cwd)
    } else {
      set({ commitError: result.error })
    }
  },

  fetch:          (cwd) => runCommand(cwd, 'fetch'),
  pull:           (cwd) => runCommand(cwd, 'pull'),
  push:           (cwd) => runCommand(cwd, 'push'),
  forcePush:      (cwd) => runCommand(cwd, 'forcePush'),
  forcePushLease: (cwd) => runCommand(cwd, 'forcePushLease'),
  checkout:       (cwd, payload) => runCommand(cwd, 'checkout', payload),
  }
})
