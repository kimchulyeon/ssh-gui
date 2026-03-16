export interface ConnectionConfig {
  host: string
  port: number
  username: string
  authType: 'key' | 'password'
  privateKeyPath?: string
  password?: string
}

export interface ConnectionProfile {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'key' | 'password'
  privateKeyPath?: string
}

export interface RemoteFile {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: string
  permissions: string
}

export interface TransferProgress {
  connectionId: string
  filename: string
  transferred: number
  total: number
  percent: number
}

export interface StatResult {
  isDirectory: boolean
  size: number
  modifiedAt: string
}

export type Screen = 'connections' | 'home' | 'browser' | 'send' | 'receive' | 'status' | 'history'

declare global {
  interface Window {
    electronAPI: {
      ssh: {
        connect: (connectionId: string, config: ConnectionConfig) => Promise<{ success: boolean; error?: string }>
        disconnect: (connectionId: string) => Promise<{ success: boolean }>
        reconnect: (connectionId: string) => Promise<{ success: boolean; attempt?: number; error?: string }>
        status: (connectionId: string) => Promise<{ connected: boolean }>
        exec: (connectionId: string, command: string) => Promise<string>
        onDisconnected: (callback: (connectionId: string) => void) => () => void
      }
      sftp: {
        readdir: (connectionId: string, path: string) => Promise<RemoteFile[]>
        mkdir: (connectionId: string, path: string) => Promise<void>
        rename: (connectionId: string, oldPath: string, newPath: string) => Promise<void>
        delete: (connectionId: string, path: string, isDir: boolean) => Promise<void>
        upload: (connectionId: string, localPath: string, remotePath: string) => Promise<void>
        download: (connectionId: string, remotePath: string, localPath: string) => Promise<void>
        stat: (connectionId: string, path: string) => Promise<StatResult>
        onProgress: (callback: (progress: TransferProgress) => void) => () => void
      }
      app: {
        saveDocFile: (filename: string) => Promise<{ success: boolean; error?: string }>
      }
      dialog: {
        openFile: (options?: { directory?: boolean; multiple?: boolean; defaultPath?: string }) => Promise<{
          canceled: boolean
          filePaths: string[]
        }>
        saveDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>
      }
      settings: {
        get: (key: string) => Promise<any>
        set: (key: string, value: any) => Promise<void>
      }
    }
  }
}
