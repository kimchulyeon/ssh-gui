import { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { SSHConnection } from './ssh/connection'
import { SFTPManager } from './ssh/sftp'

let mainWindow: BrowserWindow | null = null

const DIST = path.join(__dirname, '../dist')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// --- Multi-connection management ---

interface ManagedConnection {
  ssh: SSHConnection
  sftp: SFTPManager
  config: any
}

const connections = new Map<string, ManagedConnection>()

function getConnection(connectionId: string): ManagedConnection {
  const conn = connections.get(connectionId)
  if (!conn) throw new Error(`No connection: ${connectionId}`)
  return conn
}

// --- Window ---

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.icns')
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (icon && app.dock) {
    app.dock.setIcon(icon)
  }

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  for (const [, conn] of connections) {
    conn.ssh.disconnect()
  }
  connections.clear()
  app.quit()
})

// --- SSH Connection IPC ---

ipcMain.handle('ssh:connect', async (_event, connectionId: string, config: {
  host: string
  port: number
  username: string
  authType: 'key' | 'password'
  privateKeyPath?: string
  password?: string
}) => {
  try {
    // Duplicate guard
    for (const [existingId, conn] of connections) {
      if (existingId !== connectionId && conn.ssh.isConnected() &&
          conn.config.host === config.host && conn.config.username === config.username) {
        return { success: false, error: `Already connected to ${config.host} as ${config.username}` }
      }
    }

    // Disconnect existing if reconnecting same id
    const existing = connections.get(connectionId)
    if (existing) {
      existing.ssh.disconnect()
      connections.delete(connectionId)
    }

    const ssh = new SSHConnection()

    ssh.getClient().on('close', () => {
      if (connections.has(connectionId)) {
        mainWindow?.webContents.send('ssh:disconnected', connectionId)
      }
    })

    await ssh.connect(config)
    const sftp = new SFTPManager(ssh)
    await sftp.init()

    connections.set(connectionId, { ssh, sftp, config })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

const reconnecting = new Set<string>()

ipcMain.handle('ssh:reconnect', async (_event, connectionId: string) => {
  if (reconnecting.has(connectionId)) return { success: false, error: 'Already reconnecting' }
  const conn = connections.get(connectionId)
  if (!conn) return { success: false, error: 'No saved connection' }
  const config = conn.config

  reconnecting.add(connectionId)
  try {
    // Remove from map first to prevent close listener from firing during reconnect
    connections.delete(connectionId)
    conn.ssh.getClient().removeAllListeners('close')
    conn.ssh.disconnect()

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const ssh = new SSHConnection()
        ssh.getClient().on('close', () => {
          if (connections.has(connectionId)) {
            mainWindow?.webContents.send('ssh:disconnected', connectionId)
          }
        })
        await ssh.connect(config)
        const sftp = new SFTPManager(ssh)
        await sftp.init()
        connections.set(connectionId, { ssh, sftp, config })
        return { success: true, attempt }
      } catch (err: any) {
        if (attempt === 3) return { success: false, error: err.message }
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
    return { success: false, error: 'Reconnect failed' }
  } finally {
    reconnecting.delete(connectionId)
  }
})

ipcMain.handle('ssh:disconnect', async (_event, connectionId: string) => {
  const conn = connections.get(connectionId)
  if (conn) {
    conn.ssh.disconnect()
    connections.delete(connectionId)
  }
  return { success: true }
})

ipcMain.handle('ssh:status', async (_event, connectionId: string) => {
  const conn = connections.get(connectionId)
  return { connected: conn?.ssh.isConnected() ?? false }
})

ipcMain.handle('ssh:exec', async (_event, connectionId: string, command: string) => {
  return getConnection(connectionId).ssh.exec(command)
})

// --- SFTP IPC ---

ipcMain.handle('sftp:readdir', async (_event, connectionId: string, remotePath: string) => {
  return getConnection(connectionId).sftp.readdir(remotePath)
})

ipcMain.handle('sftp:mkdir', async (_event, connectionId: string, remotePath: string) => {
  return getConnection(connectionId).sftp.mkdir(remotePath)
})

ipcMain.handle('sftp:rename', async (_event, connectionId: string, oldPath: string, newPath: string) => {
  return getConnection(connectionId).sftp.rename(oldPath, newPath)
})

ipcMain.handle('sftp:delete', async (_event, connectionId: string, remotePath: string, isDir: boolean) => {
  const sftp = getConnection(connectionId).sftp
  if (isDir) return sftp.rmdir(remotePath)
  return sftp.unlink(remotePath)
})

ipcMain.handle('sftp:upload', async (_event, connectionId: string, localPath: string, remotePath: string) => {
  return getConnection(connectionId).sftp.upload(localPath, remotePath, (progress) => {
    mainWindow?.webContents.send('sftp:progress', { connectionId, ...progress })
  })
})

ipcMain.handle('sftp:download', async (_event, connectionId: string, remotePath: string, localPath: string) => {
  return getConnection(connectionId).sftp.download(remotePath, localPath, (progress) => {
    mainWindow?.webContents.send('sftp:progress', { connectionId, ...progress })
  })
})

ipcMain.handle('sftp:stat', async (_event, connectionId: string, remotePath: string) => {
  return getConnection(connectionId).sftp.stat(remotePath)
})

// --- Dialog IPC ---

ipcMain.handle('dialog:openFile', async (_event, options?: { directory?: boolean; multiple?: boolean; defaultPath?: string }) => {
  if (!mainWindow) return { canceled: true, filePaths: [] }
  const properties: Array<'openFile' | 'openDirectory' | 'multiSelections'> = []
  if (options?.directory) {
    properties.push('openDirectory')
  } else {
    properties.push('openFile')
  }
  if (options?.multiple) {
    properties.push('multiSelections')
  }
  const defaultPath = options?.defaultPath?.replace(/^~/, os.homedir())
  return dialog.showOpenDialog(mainWindow, {
    properties,
    defaultPath,
  })
})

ipcMain.handle('dialog:saveDirectory', async () => {
  if (!mainWindow) return { canceled: true, filePaths: [] }
  return dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  })
})

// --- App Files IPC ---

const APP_ROOT = path.join(__dirname, '..')

ipcMain.handle('app:saveDocFile', async (_event, filename: string) => {
  if (!mainWindow) return { success: false }
  const srcPath = path.join(APP_ROOT, 'docs', filename)
  if (!fs.existsSync(srcPath)) {
    return { success: false, error: 'File not found' }
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    filters: [{ name: 'Documents', extensions: ['docx', 'pdf', 'md', 'txt'] }],
  })
  if (result.canceled || !result.filePath) return { success: false }
  fs.copyFileSync(srcPath, result.filePath)
  shell.showItemInFolder(result.filePath)
  return { success: true }
})

// --- Settings IPC ---

let Store: any = null

async function getStore() {
  if (!Store) {
    const mod = await import('electron-store')
    Store = new mod.default()
  }
  return Store
}

ipcMain.handle('settings:get', async (_event, key: string) => {
  const store = await getStore()
  return store.get(key)
})

ipcMain.handle('settings:set', async (_event, key: string, value: any) => {
  const store = await getStore()
  store.set(key, value)
})
