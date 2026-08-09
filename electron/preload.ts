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
  gitWatchRoot: (cwd: string | null) => ipcRenderer.send('git:watchRoot', cwd),
  onGitChanged: (cb: (cwd: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, cwd: string) => cb(cwd)
    ipcRenderer.on('git:changed', handler)
    return () => ipcRenderer.removeListener('git:changed', handler)
  },

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
  mobileSetDisplay: (theme: string, font: string) => ipcRenderer.send('mobile:setDisplay', theme, font),
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
  getInitialProject: () => ipcRenderer.invoke('window:getInitialProject'),
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
  onMenuOpenSettings: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:openSettings', handler)
    return () => ipcRenderer.removeListener('menu:openSettings', handler)
  },
  onMenuNewFile: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:newFile', handler)
    return () => ipcRenderer.removeListener('menu:newFile', handler)
  },
  onMenuNewFolder: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:newFolder', handler)
    return () => ipcRenderer.removeListener('menu:newFolder', handler)
  },
  onMenuNewTerminal: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:newTerminal', handler)
    return () => ipcRenderer.removeListener('menu:newTerminal', handler)
  },
  onMenuReopenClosedTab: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:reopenClosedTab', handler)
    return () => ipcRenderer.removeListener('menu:reopenClosedTab', handler)
  },
  onMenuSave: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:save', handler)
    return () => ipcRenderer.removeListener('menu:save', handler)
  },
  onMenuFind: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:find', handler)
    return () => ipcRenderer.removeListener('menu:find', handler)
  },
  onMenuFindInFiles: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:findInFiles', handler)
    return () => ipcRenderer.removeListener('menu:findInFiles', handler)
  },
  onMenuToggleSidebar: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:toggleSidebar', handler)
    return () => ipcRenderer.removeListener('menu:toggleSidebar', handler)
  },
  onMenuCommandPalette: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:commandPalette', handler)
    return () => ipcRenderer.removeListener('menu:commandPalette', handler)
  },
  onMenuActionPalette: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:actionPalette', handler)
    return () => ipcRenderer.removeListener('menu:actionPalette', handler)
  },
  onMenuToggleClaudeChat: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:toggleClaudeChat', handler)
    return () => ipcRenderer.removeListener('menu:toggleClaudeChat', handler)
  },

  devtoolsAttach: (targetId: number, hostId: number) =>
    ipcRenderer.invoke('devtools:attach', targetId, hostId),
  devtoolsDetach: (targetId: number) => ipcRenderer.invoke('devtools:detach', targetId),

  browserViewCreate: (id: string, url: string) => ipcRenderer.invoke('browserView:create', id, url),
  browserViewSetBounds: (id: string, bounds: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('browserView:setBounds', id, bounds),
  browserViewSetVisible: (id: string, visible: boolean) =>
    ipcRenderer.invoke('browserView:setVisible', id, visible),
  browserViewNavigate: (id: string, url: string) => ipcRenderer.invoke('browserView:navigate', id, url),
  browserViewGoBack: (id: string) => ipcRenderer.invoke('browserView:goBack', id),
  browserViewGoForward: (id: string) => ipcRenderer.invoke('browserView:goForward', id),
  browserViewReload: (id: string) => ipcRenderer.invoke('browserView:reload', id),
  browserViewZoomIn: (id: string) => ipcRenderer.invoke('browserView:zoomIn', id),
  browserViewZoomOut: (id: string) => ipcRenderer.invoke('browserView:zoomOut', id),
  browserViewZoomReset: (id: string) => ipcRenderer.invoke('browserView:zoomReset', id),
  browserViewDestroy: (id: string) => ipcRenderer.invoke('browserView:destroy', id),
  onBrowserViewEvent: (cb: (id: string, event: import('./browserViews').BrowserViewEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, id: string, event: import('./browserViews').BrowserViewEvent) =>
      cb(id, event)
    ipcRenderer.on('browserView:event', handler)
    return () => ipcRenderer.removeListener('browserView:event', handler)
  },

  sessionLoad: (projectRoot: string) => ipcRenderer.invoke('session:load', projectRoot),
  sessionSave: (projectRoot: string, data: unknown) =>
    ipcRenderer.invoke('session:save', projectRoot, data),

  recentProjectsList: () => ipcRenderer.invoke('recentProjects:list'),
  recentProjectsAdd: (path: string) => ipcRenderer.invoke('recentProjects:add', path),
  recentProjectsClear: () => ipcRenderer.invoke('recentProjects:clear'),

  setWindowTitle: (root: string) => ipcRenderer.send('window:setTitle', root),

  autocompleteComplete: (prefix: string, suffix: string, language: string, model: string) =>
    ipcRenderer.invoke('autocomplete:complete', prefix, suffix, language, model),

  inlineEditStart: (payload: import('./inlineEdit').InlineEditStartPayload) =>
    ipcRenderer.send('inlineEdit:start', payload),
  inlineEditCancel: () => ipcRenderer.send('inlineEdit:cancel'),
  onInlineEditEvent: (cb: (event: import('./inlineEdit').InlineEditEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: import('./inlineEdit').InlineEditEvent) => cb(event)
    ipcRenderer.on('inlineEdit:event', handler)
    return () => ipcRenderer.removeListener('inlineEdit:event', handler)
  },
})
