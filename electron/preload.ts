import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // SSH
  ssh: {
    connect: (connectionId: string, config: any) => ipcRenderer.invoke('ssh:connect', connectionId, config),
    disconnect: (connectionId: string) => ipcRenderer.invoke('ssh:disconnect', connectionId),
    reconnect: (connectionId: string) => ipcRenderer.invoke('ssh:reconnect', connectionId),
    status: (connectionId: string) => ipcRenderer.invoke('ssh:status', connectionId),
    exec: (connectionId: string, command: string) => ipcRenderer.invoke('ssh:exec', connectionId, command),
    onDisconnected: (callback: (connectionId: string) => void) => {
      const handler = (_event: any, connectionId: string) => callback(connectionId)
      ipcRenderer.on('ssh:disconnected', handler)
      return () => ipcRenderer.removeListener('ssh:disconnected', handler)
    },
  },

  // SFTP
  sftp: {
    readdir: (connectionId: string, path: string) => ipcRenderer.invoke('sftp:readdir', connectionId, path),
    mkdir: (connectionId: string, path: string) => ipcRenderer.invoke('sftp:mkdir', connectionId, path),
    rename: (connectionId: string, oldPath: string, newPath: string) => ipcRenderer.invoke('sftp:rename', connectionId, oldPath, newPath),
    delete: (connectionId: string, path: string, isDir: boolean) => ipcRenderer.invoke('sftp:delete', connectionId, path, isDir),
    upload: (connectionId: string, localPath: string, remotePath: string) => ipcRenderer.invoke('sftp:upload', connectionId, localPath, remotePath),
    download: (connectionId: string, remotePath: string, localPath: string) => ipcRenderer.invoke('sftp:download', connectionId, remotePath, localPath),
    stat: (connectionId: string, path: string) => ipcRenderer.invoke('sftp:stat', connectionId, path),
    onProgress: (callback: (progress: any) => void) => {
      const handler = (_event: any, progress: any) => callback(progress)
      ipcRenderer.on('sftp:progress', handler)
      return () => ipcRenderer.removeListener('sftp:progress', handler)
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
