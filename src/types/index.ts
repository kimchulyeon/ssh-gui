export interface ConnectionConfig {
  host: string
  port: number
  username: string
  authType: 'key' | 'password'
  privateKeyPath?: string
  password?: string
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

export type Screen = 'connection' | 'home' | 'browser' | 'send' | 'receive' | 'search' | 'status' | 'history'

declare global {
  interface Window {
    electronAPI: {
      ssh: {
        connect: (config: ConnectionConfig) => Promise<{ success: boolean; error?: string }>
        disconnect: () => Promise<{ success: boolean }>
        reconnect: () => Promise<{ success: boolean; attempt?: number; error?: string }>
        status: () => Promise<{ connected: boolean }>
        exec: (command: string) => Promise<string>
        onDisconnected: (callback: () => void) => () => void
      }
      sftp: {
        readdir: (path: string) => Promise<RemoteFile[]>
        mkdir: (path: string) => Promise<void>
        rename: (oldPath: string, newPath: string) => Promise<void>
        delete: (path: string, isDir: boolean) => Promise<void>
        upload: (localPath: string, remotePath: string) => Promise<void>
        download: (remotePath: string, localPath: string) => Promise<void>
        stat: (path: string) => Promise<StatResult>
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
