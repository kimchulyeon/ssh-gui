import { useState, useCallback } from 'react'
import type { TransferProgress } from '../types'
import { showToast } from './ui/Toast'
import DuplicateDialog from './ui/DuplicateDialog'
import { addHistory } from './HistoryScreen'

interface Props {
  remoteUser: string
  progress: TransferProgress | null
  onClearProgress: () => void
}

interface SelectedFile {
  path: string
  name: string
  isDirectory: boolean
}

async function remoteExists(path: string): Promise<boolean> {
  try {
    await window.electronAPI.sftp.stat(path)
    return true
  } catch {
    return false
  }
}

function getRenamed(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return `${name} (copy)`
  return `${name.slice(0, dot)} (copy)${name.slice(dot)}`
}

export default function SendScreen({ remoteUser, progress, onClearProgress }: Props) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [remotePath, setRemotePath] = useState(`/Users/${remoteUser}/Desktop`)
  const [transferring, setTransferring] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState<{ file: SelectedFile; dest: string; resolve: (action: 'overwrite' | 'skip' | 'rename') => void } | null>(null)

  const handleSelectFiles = useCallback(async () => {
    const result = await window.electronAPI.dialog.openFile({ multiple: true })
    if (!result.canceled) {
      setSelectedFiles(
        result.filePaths.map((p) => ({
          path: p,
          name: p.split('/').pop() || p,
          isDirectory: false,
        }))
      )
      setDone(false)
      setError('')
    }
  }, [])

  const handleSelectFolder = useCallback(async () => {
    const result = await window.electronAPI.dialog.openFile({ directory: true, multiple: true })
    if (!result.canceled) {
      setSelectedFiles((prev) => [
        ...prev,
        ...result.filePaths.map((p) => ({
          path: p,
          name: p.split('/').pop() || p,
          isDirectory: true,
        })),
      ])
      setDone(false)
      setError('')
    }
  }, [])

  const handleChangeRemotePath = useCallback(async () => {
    const path = prompt('Remote destination path:', remotePath)
    if (path) setRemotePath(path)
  }, [remotePath])

  const askDuplicateAction = useCallback((file: SelectedFile, dest: string): Promise<'overwrite' | 'skip' | 'rename'> => {
    return new Promise((resolve) => {
      setDuplicate({ file, dest, resolve })
    })
  }, [])

  const handleSend = useCallback(async () => {
    if (selectedFiles.length === 0) return
    setTransferring(true)
    setError('')
    setDone(false)
    onClearProgress()

    let sent = 0
    try {
      for (const file of selectedFiles) {
        let dest = `${remotePath}/${file.name}`

        if (await remoteExists(dest)) {
          const action = await askDuplicateAction(file, dest)
          if (action === 'skip') continue
          if (action === 'rename') {
            dest = `${remotePath}/${getRenamed(file.name)}`
          }
          // 'overwrite' — just upload to same dest
        }

        await window.electronAPI.sftp.upload(file.path, dest)
        addHistory({ filename: file.name, direction: 'upload', success: true })
        sent++
      }
      setDone(true)
      if (sent > 0) showToast('success', `Sent ${sent} file(s) to Mac Mini`)
    } catch (err: any) {
      setError(err.message || 'Transfer failed')
      showToast('error', `Send failed: ${err.message}`)
      addHistory({ filename: 'Upload', direction: 'upload', success: false, error: err.message })
    } finally {
      setTransferring(false)
    }
  }, [selectedFiles, remotePath, onClearProgress, askDuplicateAction])

  const removeFile = useCallback((path: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.path !== path))
  }, [])

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="mac-card bg-mac-card rounded-mac p-8 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-mac-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Send Files
        </h2>

        {/* File selection */}
        <div className="space-y-3 mb-6">
          <div className="flex gap-2">
            <button
              onClick={handleSelectFiles}
              className="flex-1 bg-mac-input border border-mac-border rounded-lg px-4 py-2.5 text-sm text-mac-muted hover:text-white hover:border-mac-accent/50 transition-colors"
            >
              Select Files
            </button>
            <button
              onClick={handleSelectFolder}
              className="flex-1 bg-mac-input border border-mac-border rounded-lg px-4 py-2.5 text-sm text-mac-muted hover:text-white hover:border-mac-accent/50 transition-colors"
            >
              Select Folder
            </button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="bg-mac-input border border-mac-border rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
              {selectedFiles.map((file) => (
                <div key={file.path} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-mac-muted text-xs">
                      {file.isDirectory ? (
                        <svg className="w-4 h-4 text-mac-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{file.name}</span>
                  </div>
                  <button
                    onClick={() => removeFile(file.path)}
                    className="text-mac-muted hover:text-mac-danger text-xs ml-2 shrink-0"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remote destination */}
        <div className="mb-6">
          <label className="block text-[10px] uppercase font-semibold text-mac-muted mb-1 ml-1">
            Destination (Mac Mini)
          </label>
          <div className="flex gap-2">
            <div className="flex-1 bg-mac-input border border-mac-border rounded-lg px-3 py-2 text-sm text-mac-muted truncate">
              {remotePath}
            </div>
            <button
              onClick={handleChangeRemotePath}
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

        {done && (
          <div className="mb-4 text-xs text-mac-success bg-mac-success/10 rounded-lg px-3 py-2">
            Transfer complete!
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={selectedFiles.length === 0 || transferring}
          className="w-full bg-mac-accent hover:bg-blue-600 active:scale-[0.98] transition-all py-2.5 rounded-mac font-semibold text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {transferring ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Duplicate file dialog */}
      {duplicate && (
        <DuplicateDialog
          filename={duplicate.file.name}
          onOverwrite={() => { duplicate.resolve('overwrite'); setDuplicate(null) }}
          onSkip={() => { duplicate.resolve('skip'); setDuplicate(null) }}
          onRename={() => { duplicate.resolve('rename'); setDuplicate(null) }}
        />
      )}
    </div>
  )
}
