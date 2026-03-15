import { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { SSHConnection } from './ssh/connection'
import { SFTPManager } from './ssh/sftp'

let mainWindow: BrowserWindow | null = null
let sshConnection: SSHConnection | null = null
let sftpManager: SFTPManager | null = null

const DIST = path.join(__dirname, '../dist')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

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
  sshConnection?.disconnect()
  app.quit()
})

// --- SSH Connection IPC ---

let lastConfig: any = null

ipcMain.handle('ssh:connect', async (_event, config: {
  host: string
  port: number
  username: string
  authType: 'key' | 'password'
  privateKeyPath?: string
  password?: string
}) => {
  try {
    sshConnection?.disconnect()
    sshConnection = new SSHConnection()

    // Listen for unexpected disconnects
    sshConnection.getClient().on('close', () => {
      if (lastConfig) {
        mainWindow?.webContents.send('ssh:disconnected')
      }
    })

    await sshConnection.connect(config)
    sftpManager = new SFTPManager(sshConnection)
    await sftpManager.init()
    lastConfig = config
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('ssh:reconnect', async () => {
  if (!lastConfig) return { success: false, error: 'No saved connection' }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      sshConnection?.disconnect()
      sshConnection = new SSHConnection()
      sshConnection.getClient().on('close', () => {
        mainWindow?.webContents.send('ssh:disconnected')
      })
      await sshConnection.connect(lastConfig)
      sftpManager = new SFTPManager(sshConnection)
      await sftpManager.init()
      return { success: true, attempt }
    } catch (err: any) {
      if (attempt === 3) return { success: false, error: err.message }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  return { success: false, error: 'Reconnect failed' }
})

ipcMain.handle('ssh:disconnect', async () => {
  lastConfig = null
  sftpManager = null
  sshConnection?.disconnect()
  sshConnection = null
  return { success: true }
})

ipcMain.handle('ssh:status', async () => {
  return { connected: sshConnection?.isConnected() ?? false }
})

ipcMain.handle('ssh:exec', async (_event, command: string) => {
  if (!sshConnection) throw new Error('Not connected')
  return sshConnection.exec(command)
})

// --- SFTP IPC ---

ipcMain.handle('sftp:readdir', async (_event, remotePath: string) => {
  if (!sftpManager) throw new Error('Not connected')
  return sftpManager.readdir(remotePath)
})

ipcMain.handle('sftp:mkdir', async (_event, remotePath: string) => {
  if (!sftpManager) throw new Error('Not connected')
  return sftpManager.mkdir(remotePath)
})

ipcMain.handle('sftp:rename', async (_event, oldPath: string, newPath: string) => {
  if (!sftpManager) throw new Error('Not connected')
  return sftpManager.rename(oldPath, newPath)
})

ipcMain.handle('sftp:delete', async (_event, remotePath: string, isDir: boolean) => {
  if (!sftpManager) throw new Error('Not connected')
  if (isDir) {
    return sftpManager.rmdir(remotePath)
  }
  return sftpManager.unlink(remotePath)
})

ipcMain.handle('sftp:upload', async (event, localPath: string, remotePath: string) => {
  if (!sftpManager) throw new Error('Not connected')
  return sftpManager.upload(localPath, remotePath, (progress) => {
    mainWindow?.webContents.send('sftp:progress', progress)
  })
})

ipcMain.handle('sftp:download', async (event, remotePath: string, localPath: string) => {
  if (!sftpManager) throw new Error('Not connected')
  return sftpManager.download(remotePath, localPath, (progress) => {
    mainWindow?.webContents.send('sftp:progress', progress)
  })
})

ipcMain.handle('sftp:stat', async (_event, remotePath: string) => {
  if (!sftpManager) throw new Error('Not connected')
  return sftpManager.stat(remotePath)
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

const APP_ROOT = VITE_DEV_SERVER_URL
  ? path.join(__dirname, '..')
  : path.join(__dirname, '..')

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
