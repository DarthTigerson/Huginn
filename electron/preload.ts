import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  readDir: (path: string) => ipcRenderer.invoke('fs:readDir', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('fs:writeFile', path, content),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  gitBranch: (cwd: string) => ipcRenderer.invoke('git:branch', cwd),
  gitAheadBehind: (cwd: string) => ipcRenderer.invoke('git:aheadBehind', cwd),
  gitStatus: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
  gitStage: (cwd: string, paths: string[]) => ipcRenderer.invoke('git:stage', cwd, paths),
  gitUnstage: (cwd: string, paths: string[]) => ipcRenderer.invoke('git:unstage', cwd, paths),
  gitStageAll: (cwd: string) => ipcRenderer.invoke('git:stageAll', cwd),
  gitUnstageAll: (cwd: string) => ipcRenderer.invoke('git:unstageAll', cwd),
  gitCommit: (cwd: string, message: string) => ipcRenderer.invoke('git:commit', cwd, message),
  gitDiff: (cwd: string, path: string, staged: boolean) =>
    ipcRenderer.invoke('git:diff', cwd, path, staged),
  gitRunCommand: (id: string, cwd: string, action: string) =>
    ipcRenderer.invoke('git:runCommand', id, cwd, action),
  onGitLogData: (cb: (id: string, data: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, id: string, data: string) => cb(id, data)
    ipcRenderer.on('git:log:data', handler)
    return () => ipcRenderer.removeListener('git:log:data', handler)
  },
  onGitLogExit: (cb: (id: string, code: number) => void) => {
    const handler = (_: Electron.IpcRendererEvent, id: string, code: number) => cb(id, code)
    ipcRenderer.on('git:log:exit', handler)
    return () => ipcRenderer.removeListener('git:log:exit', handler)
  },
  gitGraph: (cwd: string) => ipcRenderer.invoke('git:graph', cwd),
  gitShowStat: (cwd: string, hash: string) => ipcRenderer.invoke('git:showStat', cwd, hash),

  termSpawn: () => ipcRenderer.invoke('term:spawn'),
  termWrite: (data: string) => ipcRenderer.send('term:write', data),
  termResize: (cols: number, rows: number) =>
    ipcRenderer.send('term:resize', cols, rows),
  onTermData: (cb: (data: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: string) => cb(data)
    ipcRenderer.on('term:data', handler)
    return () => ipcRenderer.removeListener('term:data', handler)
  },

  assistantSpawn: (cwd: string, assistant: 'claude' | 'codex', mode?: 'new' | 'continue') =>
    ipcRenderer.invoke('assistant:spawn', cwd, assistant, mode),
  assistantWrite: (assistant: 'claude' | 'codex', data: string) =>
    ipcRenderer.send('assistant:write', assistant, data),
  assistantResize: (assistant: 'claude' | 'codex', cols: number, rows: number) =>
    ipcRenderer.send('assistant:resize', assistant, cols, rows),
  onAssistantData: (cb: (assistant: 'claude' | 'codex', data: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, assistant: 'claude' | 'codex', data: string) => cb(assistant, data)
    ipcRenderer.on('assistant:data', handler)
    return () => ipcRenderer.removeListener('assistant:data', handler)
  },
})
