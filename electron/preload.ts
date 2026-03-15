import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // SSH
  ssh: {
    connect: (config: any) => ipcRenderer.invoke('ssh:connect', config),
    disconnect: () => ipcRenderer.invoke('ssh:disconnect'),
    reconnect: () => ipcRenderer.invoke('ssh:reconnect'),
    status: () => ipcRenderer.invoke('ssh:status'),
    exec: (command: string) => ipcRenderer.invoke('ssh:exec', command),
    onDisconnected: (callback: () => void) => {
      ipcRenderer.on('ssh:disconnected', () => callback())
      return () => ipcRenderer.removeAllListeners('ssh:disconnected')
    },
  },

  // SFTP
  sftp: {
    readdir: (path: string) => ipcRenderer.invoke('sftp:readdir', path),
    mkdir: (path: string) => ipcRenderer.invoke('sftp:mkdir', path),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('sftp:rename', oldPath, newPath),
    delete: (path: string, isDir: boolean) => ipcRenderer.invoke('sftp:delete', path, isDir),
    upload: (localPath: string, remotePath: string) => ipcRenderer.invoke('sftp:upload', localPath, remotePath),
    download: (remotePath: string, localPath: string) => ipcRenderer.invoke('sftp:download', remotePath, localPath),
    stat: (path: string) => ipcRenderer.invoke('sftp:stat', path),
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('sftp:progress', (_event, progress) => callback(progress))
      return () => ipcRenderer.removeAllListeners('sftp:progress')
    },
  },

  // App files
  app: {
    saveDocFile: (filename: string) => ipcRenderer.invoke('app:saveDocFile', filename),
  },

  // Dialogs
  dialog: {
    openFile: (options?: { directory?: boolean; multiple?: boolean; defaultPath?: string }) =>
      ipcRenderer.invoke('dialog:openFile', options),
    saveDirectory: () => ipcRenderer.invoke('dialog:saveDirectory'),
  },

  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  },
})
