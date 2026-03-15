import type { SFTPWrapper, FileEntry } from 'ssh2'
import type { SSHConnection } from './connection'
import fs from 'fs'
import path from 'path'

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

export class SFTPManager {
  private sftp: SFTPWrapper | null = null
  private connection: SSHConnection

  constructor(connection: SSHConnection) {
    this.connection = connection
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connection.getClient().sftp((err, sftp) => {
        if (err) return reject(err)
        this.sftp = sftp
        resolve()
      })
    })
  }

  async readdir(remotePath: string): Promise<RemoteFile[]> {
    if (!this.sftp) throw new Error('SFTP not initialized')
    return new Promise((resolve, reject) => {
      this.sftp!.readdir(remotePath, (err, list) => {
        if (err) return reject(err)
        const files: RemoteFile[] = list
          .filter((item) => item.filename !== '.' && item.filename !== '..')
          .map((item) => ({
            name: item.filename,
            path: remotePath === '/' ? `/${item.filename}` : `${remotePath}/${item.filename}`,
            isDirectory: (item.attrs.mode! & 0o40000) !== 0,
            size: item.attrs.size ?? 0,
            modifiedAt: new Date((item.attrs.mtime ?? 0) * 1000).toISOString(),
            permissions: (item.attrs.mode ?? 0).toString(8),
          }))
          .sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
            return a.name.localeCompare(b.name)
          })
        resolve(files)
      })
    })
  }

  async mkdir(remotePath: string): Promise<void> {
    if (!this.sftp) throw new Error('SFTP not initialized')
    return new Promise((resolve, reject) => {
      this.sftp!.mkdir(remotePath, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    if (!this.sftp) throw new Error('SFTP not initialized')
    return new Promise((resolve, reject) => {
      this.sftp!.rename(oldPath, newPath, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  async unlink(remotePath: string): Promise<void> {
    if (!this.sftp) throw new Error('SFTP not initialized')
    return new Promise((resolve, reject) => {
      this.sftp!.unlink(remotePath, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  async rmdir(remotePath: string): Promise<void> {
    if (!this.sftp) throw new Error('SFTP not initialized')
    const files = await this.readdir(remotePath)
    for (const file of files) {
      if (file.isDirectory) {
        await this.rmdir(file.path)
      } else {
        await this.unlink(file.path)
      }
    }
    return new Promise((resolve, reject) => {
      this.sftp!.rmdir(remotePath, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  async stat(remotePath: string): Promise<any> {
    if (!this.sftp) throw new Error('SFTP not initialized')
    return new Promise((resolve, reject) => {
      this.sftp!.stat(remotePath, (err, stats) => {
        if (err) return reject(err)
        resolve({
          isDirectory: (stats.mode! & 0o40000) !== 0,
          size: stats.size,
          modifiedAt: new Date((stats.mtime ?? 0) * 1000).toISOString(),
        })
      })
    })
  }

  async upload(
    localPath: string,
    remotePath: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<void> {
    if (!this.sftp) throw new Error('SFTP not initialized')

    const stats = fs.statSync(localPath)
    if (stats.isDirectory()) {
      return this.uploadDirectory(localPath, remotePath, onProgress)
    }

    const total = stats.size
    const filename = path.basename(localPath)

    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(localPath)
      const writeStream = this.sftp!.createWriteStream(remotePath)
      let transferred = 0

      readStream.on('data', (chunk: Buffer) => {
        transferred += chunk.length
        onProgress?.({
          filename,
          transferred,
          total,
          percent: Math.round((transferred / total) * 100),
        })
      })

      writeStream.on('close', () => resolve())
      writeStream.on('error', reject)
      readStream.on('error', reject)
      readStream.pipe(writeStream)
    })
  }

  private async uploadDirectory(
    localPath: string,
    remotePath: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<void> {
    try {
      await this.mkdir(remotePath)
    } catch {
      // directory may already exist
    }

    const entries = fs.readdirSync(localPath, { withFileTypes: true })
    for (const entry of entries) {
      const localEntry = path.join(localPath, entry.name)
      const remoteEntry = `${remotePath}/${entry.name}`
      if (entry.isDirectory()) {
        await this.uploadDirectory(localEntry, remoteEntry, onProgress)
      } else {
        await this.upload(localEntry, remoteEntry, onProgress)
      }
    }
  }

  async download(
    remotePath: string,
    localPath: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<void> {
    if (!this.sftp) throw new Error('SFTP not initialized')

    const stats = await this.stat(remotePath)
    if (stats.isDirectory) {
      return this.downloadDirectory(remotePath, localPath, onProgress)
    }

    const total = stats.size
    const filename = path.basename(remotePath)

    return new Promise((resolve, reject) => {
      const readStream = this.sftp!.createReadStream(remotePath)
      const writeStream = fs.createWriteStream(localPath)
      let transferred = 0

      readStream.on('data', (chunk: Buffer) => {
        transferred += chunk.length
        onProgress?.({
          filename,
          transferred,
          total,
          percent: Math.round((transferred / total) * 100),
        })
      })

      writeStream.on('close', () => resolve())
      writeStream.on('error', reject)
      readStream.on('error', reject)
      readStream.pipe(writeStream)
    })
  }

  private async downloadDirectory(
    remotePath: string,
    localPath: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<void> {
    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true })
    }

    const files = await this.readdir(remotePath)
    for (const file of files) {
      const localEntry = path.join(localPath, file.name)
      if (file.isDirectory) {
        await this.downloadDirectory(file.path, localEntry, onProgress)
      } else {
        await this.download(file.path, localEntry, onProgress)
      }
    }
  }
}
