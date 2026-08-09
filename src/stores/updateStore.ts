import { create } from 'zustand'
import { useEditorStore } from './editorStore'
import { buildTerminalPath } from '@/components/Settings/paths'
import { pendingTerminalCommands } from '@/components/Terminal/TerminalTab'
import type { UpdateInfo } from '@/types/api'

const SENTINEL_PREFIX = '__HUGINN_UPDATE_EXIT_'
const UPDATE_COMMAND =
  `HUGINN_NO_LAUNCH=1 curl -fsSL https://raw.githubusercontent.com/DarthTigerson/Huginn/main/install.sh | bash; ` +
  `echo "${SENTINEL_PREFIX}$?__"\n`

export type UpdateStatus = 'idle' | 'updating' | 'ready' | 'failed'

interface UpdateState {
  available: UpdateInfo | null
  status: UpdateStatus
  setAvailable: (info: UpdateInfo | null) => void
  startUpdate: () => void
  restart: () => void
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  available: null,
  status: 'idle',

  setAvailable: (info) => set({ available: info }),

  startUpdate: () => {
    if (get().status === 'updating') return
    set({ status: 'updating' })

    const id = Date.now().toString(36)
    pendingTerminalCommands.set(id, UPDATE_COMMAND)
    useEditorStore.getState().openTab({ path: buildTerminalPath(id), content: '', dirty: false })

    let buffer = ''
    const unsubscribe = window.api.onTermData((termId, data) => {
      if (termId !== id) return
      buffer = (buffer + data).slice(-500)
      const match = buffer.match(new RegExp(`${SENTINEL_PREFIX}(\\d+)__`))
      if (match) {
        unsubscribe()
        set({ status: match[1] === '0' ? 'ready' : 'failed' })
      }
    })
  },

  restart: () => {
    window.api.updateRestart()
  },
}))
