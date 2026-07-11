import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  readDir: (path: string) => ipcRenderer.invoke('fs:readDir', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('fs:writeFile', path, content),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  termSpawn: () => ipcRenderer.invoke('term:spawn'),
  termWrite: (data: string) => ipcRenderer.send('term:write', data),
  termResize: (cols: number, rows: number) =>
    ipcRenderer.send('term:resize', cols, rows),
  onTermData: (cb: (data: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: string) => cb(data)
    ipcRenderer.on('term:data', handler)
    return () => ipcRenderer.removeListener('term:data', handler)
  },

  claudeSpawn: (cwd: string, mode?: 'new' | 'continue') =>
    ipcRenderer.invoke('claude:spawn', cwd, mode),
  claudeWrite: (data: string) => ipcRenderer.send('claude:write', data),
  claudeResize: (cols: number, rows: number) =>
    ipcRenderer.send('claude:resize', cols, rows),
  onClaudeData: (cb: (data: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: string) => cb(data)
    ipcRenderer.on('claude:data', handler)
    return () => ipcRenderer.removeListener('claude:data', handler)
  },
})
