import { useState, useEffect, useCallback } from 'react'
import type { RemoteFile, TransferProgress } from '../types'
import { showToast } from './ui/Toast'
import { addHistory } from './HistoryScreen'
import { formatSize } from '../utils/format'

interface Props {
  remoteUser: string
  progress: TransferProgress | null
  onClearProgress: () => void
}

export default function ReceiveScreen({ remoteUser, progress, onClearProgress }: Props) {
  const [remotePath, setRemotePath] = useState(`/Users/${remoteUser}`)
  const [files, setFiles] = useState<RemoteFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [localPath, setLocalPath] = useState('~/Downloads')
  const [transferring, setTransferring] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const loadFiles = useCallback(async (path: string) => {
    try {
      const result = await window.electronAPI.sftp.readdir(path)
      setFiles(result)
      setRemotePath(path)
      setSelectedFiles(new Set())
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    loadFiles(remotePath)
  }, [])

  const toggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleChooseLocalPath = useCallback(async () => {
    const result = await window.electronAPI.dialog.saveDirectory()
    if (!result.canceled && result.filePaths[0]) {
      setLocalPath(result.filePaths[0])
    }
  }, [])

  const handleReceive = useCallback(async () => {
    if (selectedFiles.size === 0) return
    setTransferring(true)
    setError('')
    setDone(false)
    onClearProgress()

    try {
      for (const filePath of selectedFiles) {
        const fileName = filePath.split('/').pop() || filePath
        const dest = `${localPath}/${fileName}`
        await window.electronAPI.sftp.download(filePath, dest)
        addHistory({ filename: fileName, direction: 'download', success: true })
      }
      setDone(true)
      showToast('success', `Downloaded ${selectedFiles.size} file(s)`)
    } catch (err: any) {
      setError(err.message || 'Download failed')
      showToast('error', `Download failed: ${err.message}`)
      addHistory({ filename: 'Download', direction: 'download', success: false, error: err.message })
    } finally {
      setTransferring(false)
    }
  }, [selectedFiles, localPath, onClearProgress])

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="mac-card bg-mac-card rounded-mac p-8 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-mac-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Receive Files
        </h2>

        {/* Remote file browser */}
        <div className="mb-4">
          <label className="block text-[10px] uppercase font-semibold text-mac-muted mb-1 ml-1">
            Select from Mac Mini
          </label>

          {/* Path navigation */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => {
                const parent = remotePath.split('/').slice(0, -1).join('/') || '/'
                loadFiles(parent)
              }}
              className="bg-mac-border hover:bg-mac-hover px-2 py-1 rounded text-xs transition-colors"
            >
              &uarr;
            </button>
            <div className="flex-1 bg-mac-input border border-mac-border rounded-lg px-3 py-1.5 text-xs text-mac-muted truncate">
              {remotePath}
            </div>
          </div>

          {/* File list */}
          <div className="bg-mac-input border border-mac-border rounded-lg max-h-52 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-2 px-3 py-2 hover:bg-mac-border/30 transition-colors cursor-pointer border-b border-mac-border/30 last:border-0"
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFile(file.path)}
                  className="rounded border-mac-border bg-mac-input text-mac-accent focus:ring-mac-accent focus:ring-offset-0 w-3.5 h-3.5"
                />
                <button
                  onClick={() => {
                    if (file.isDirectory) {
                      loadFiles(file.path)
                    } else {
                      toggleFile(file.path)
                    }
                  }}
                  className="flex-1 flex items-center gap-2 text-sm text-left"
                >
                  {file.isDirectory ? (
                    <svg className="w-4 h-4 text-mac-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-mac-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  <span className="truncate">{file.name}</span>
                  {!file.isDirectory && (
                    <span className="text-xs text-mac-muted ml-auto shrink-0">{formatSize(file.size)}</span>
                  )}
                </button>
              </div>
            ))}
            {files.length === 0 && (
              <div className="text-center text-mac-muted text-sm py-8">Empty folder</div>
            )}
          </div>
        </div>

        {/* Local destination */}
        <div className="mb-6">
          <label className="block text-[10px] uppercase font-semibold text-mac-muted mb-1 ml-1">
            Save to (Local)
          </label>
          <div className="flex gap-2">
            <div className="flex-1 bg-mac-input border border-mac-border rounded-lg px-3 py-2 text-sm text-mac-muted truncate">
              {localPath}
            </div>
            <button
              onClick={handleChooseLocalPath}
              className="bg-mac-border hover:bg-mac-hover px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            >
              Change
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 text-xs text-mac-danger bg-mac-danger/10 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Progress */}
        {transferring && progress && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-mac-muted mb-1">
              <span className="truncate mr-2">{progress.filename}</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="w-full bg-mac-border rounded-full h-2">
              <div
                className="bg-mac-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Done */}
        {done && (
          <div className="mb-4 text-xs text-mac-success bg-mac-success/10 rounded-lg px-3 py-2">
            Download complete!
          </div>
        )}

        {/* Receive button */}
        <button
          onClick={handleReceive}
          disabled={selectedFiles.size === 0 || transferring}
          className="w-full bg-mac-accent hover:bg-blue-600 active:scale-[0.98] transition-all py-2.5 rounded-mac font-semibold text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {transferring ? 'Downloading...' : `Receive${selectedFiles.size > 0 ? ` (${selectedFiles.size})` : ''}`}
        </button>
      </div>
    </div>
  )
}
