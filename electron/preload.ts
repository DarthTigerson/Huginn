import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  readDir: (path: string) => ipcRenderer.invoke('fs:readDir', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  pathExists: (path: string) => ipcRenderer.invoke('fs:exists', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('fs:writeFile', path, content),
  mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
  renamePath: (from: string, to: string) => ipcRenderer.invoke('fs:rename', from, to),
  trashPath: (path: string) => ipcRenderer.invoke('fs:trash', path),
  listAllFiles: (root: string) => ipcRenderer.invoke('fs:listAllFiles', root),
  searchText: (root: string, query: string, caseSensitive: boolean) =>
    ipcRenderer.invoke('fs:searchText', root, query, caseSensitive),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  gitBranch: (cwd: string) => ipcRenderer.invoke('git:branch', cwd),
  gitAheadBehind: (cwd: string) => ipcRenderer.invoke('git:aheadBehind', cwd),
  gitStatus: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
  gitStage: (cwd: string, paths: string[]) => ipcRenderer.invoke('git:stage', cwd, paths),
  gitUnstage: (cwd: string, paths: string[]) => ipcRenderer.invoke('git:unstage', cwd, paths),
  gitStageAll: (cwd: string) => ipcRenderer.invoke('git:stageAll', cwd),
  gitUnstageAll: (cwd: string) => ipcRenderer.invoke('git:unstageAll', cwd),
  gitDiscard: (cwd: string, path: string) => ipcRenderer.invoke('git:discard', cwd, path),
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
  gitBranches: (cwd: string) => ipcRenderer.invoke('git:branches', cwd),
  gitBranchDiff: (cwd: string, source: string, target: string) =>
    ipcRenderer.invoke('git:branchDiff', cwd, source, target),
  gitShowStat: (cwd: string, hash: string) => ipcRenderer.invoke('git:showStat', cwd, hash),

  termSpawn: (id: string, cwd?: string) => ipcRenderer.invoke('term:spawn', id, cwd),
  termKill: (id: string) => ipcRenderer.invoke('term:kill', id),
  termWrite: (id: string, data: string) => ipcRenderer.send('term:write', id, data),
  termResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('term:resize', id, cols, rows),
  onTermData: (cb: (id: string, data: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, id: string, data: string) => cb(id, data)
    ipcRenderer.on('term:data', handler)
    return () => ipcRenderer.removeListener('term:data', handler)
  },
  onTermExit: (cb: (id: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, id: string) => cb(id)
    ipcRenderer.on('term:exit', handler)
    return () => ipcRenderer.removeListener('term:exit', handler)
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

  mobileStart: () => ipcRenderer.invoke('mobile:start'),
  mobileStop: () => ipcRenderer.invoke('mobile:stop'),
  mobileGetState: () => ipcRenderer.invoke('mobile:getState'),
  mobileAddDevice: () => ipcRenderer.invoke('mobile:addDevice'),
  onMobileState: (cb: (state: import('./mobile').MobileState) => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: import('./mobile').MobileState) => cb(state)
    ipcRenderer.on('mobile:state', handler)
    return () => ipcRenderer.removeListener('mobile:state', handler)
  },

  cosmosSend: (cwd: string, messages: unknown[], agentMode: boolean, settings: unknown) =>
    ipcRenderer.send('cosmos:send', { cwd, messages, agentMode, settings }),
  cosmosApprove: (toolCallId: string) => ipcRenderer.send('cosmos:approve', toolCallId),
  cosmosReject: (toolCallId: string) => ipcRenderer.send('cosmos:reject', toolCallId),
  cosmosCancel: () => ipcRenderer.send('cosmos:cancel'),
  cosmosTestConnection: (settings: unknown) => ipcRenderer.invoke('cosmos:testConnection', settings),
  cosmosGetSettings: () => ipcRenderer.invoke('cosmos:getSettings'),
  cosmosSetSettings: (settings: unknown) => ipcRenderer.invoke('cosmos:setSettings', settings),
  onCosmosEvent: (cb: (event: import('./cosmos').CosmosEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: import('./cosmos').CosmosEvent) => cb(event)
    ipcRenderer.on('cosmos:event', handler)
    return () => ipcRenderer.removeListener('cosmos:event', handler)
  },

  onMenuOpenProject: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:openProject', handler)
    return () => ipcRenderer.removeListener('menu:openProject', handler)
  },
  onMenuCloseActiveTab: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:closeActiveTab', handler)
    return () => ipcRenderer.removeListener('menu:closeActiveTab', handler)
  },
  onMenuZoomIn: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:zoomIn', handler)
    return () => ipcRenderer.removeListener('menu:zoomIn', handler)
  },
  onMenuZoomOut: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:zoomOut', handler)
    return () => ipcRenderer.removeListener('menu:zoomOut', handler)
  },
  onMenuResetZoom: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:resetZoom', handler)
    return () => ipcRenderer.removeListener('menu:resetZoom', handler)
  },
})
