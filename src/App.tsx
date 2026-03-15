import { useState, useEffect, useCallback } from 'react'
import type { Screen, ConnectionConfig, TransferProgress } from './types'
import ConnectionScreen from './components/ConnectionScreen'
import HomeScreen from './components/HomeScreen'
import FileBrowser from './components/FileBrowser'
import SendScreen from './components/SendScreen'
import ReceiveScreen from './components/ReceiveScreen'
import StatusScreen from './components/StatusScreen'
import HistoryScreen, { addHistory } from './components/HistoryScreen'
import ToastContainer, { showToast } from './components/ui/Toast'
import appIcon from './assets/app-icon.png'

export default function App() {
  const [screen, setScreen] = useState<Screen>('connection')
  const [connected, setConnected] = useState(false)
  const [progress, setProgress] = useState<TransferProgress | null>(null)
  const [remoteUser, setRemoteUser] = useState('')
  const [autoConnecting, setAutoConnecting] = useState(true)

  useEffect(() => {
    const cleanup = window.electronAPI.sftp.onProgress((p) => {
      setProgress(p)
    })
    return cleanup
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const saved = await window.electronAPI.settings.get('connection')
        // Only auto-connect with SSH key auth (password is not saved)
        if (!saved?.host || !saved?.username || saved?.authType === 'password') {
          setAutoConnecting(false)
          return
        }
        const result = await window.electronAPI.ssh.connect(saved)
        if (result.success) {
          setConnected(true)
          setRemoteUser(saved.username)
          setScreen('home')
        } else {
          setScreen('connection')
        }
      } catch {
        setScreen('connection')
      } finally {
        setAutoConnecting(false)
      }
    })()
  }, [])

  // Auto-reconnect on unexpected disconnect
  useEffect(() => {
    const cleanup = window.electronAPI.ssh.onDisconnected(async () => {
      setConnected(false)
      showToast('info', 'Connection lost. Reconnecting...')
      const result = await window.electronAPI.ssh.reconnect()
      if (result.success) {
        setConnected(true)
        showToast('success', `Reconnected (attempt ${result.attempt})`)
      } else {
        showToast('error', 'Reconnect failed. Please reconnect manually.')
        setScreen('connection')
      }
    })
    return cleanup
  }, [])

  const handleConnected = useCallback((username: string) => {
    setConnected(true)
    setRemoteUser(username)
    setScreen('home')
  }, [])

  const handleDisconnect = useCallback(async () => {
    await window.electronAPI.ssh.disconnect()
    setConnected(false)
    setScreen('connection')
  }, [])

  const navigate = useCallback((s: Screen) => setScreen(s), [])

  // Global drag & drop upload
  const [dragging, setDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!connected) return
    e.preventDefault()
    setDragging(true)
  }, [connected])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (!connected || !remoteUser) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const dest = `/Users/${remoteUser}/Desktop`
    showToast('info', `Uploading ${files.length} file(s) to ${dest}...`)

    let uploaded = 0
    for (const file of files) {
      try {
        await window.electronAPI.sftp.upload(file.path, `${dest}/${file.name}`)
        addHistory({ filename: file.name, direction: 'upload', success: true })
        uploaded++
      } catch (err: any) {
        showToast('error', `Failed to upload ${file.name}`)
        addHistory({ filename: file.name, direction: 'upload', success: false, error: err.message })
      }
    }
    if (uploaded > 0) showToast('success', `Uploaded ${uploaded} file(s) to Mac Mini Desktop`)
  }, [connected, remoteUser])

  return (
    <div
      className="h-screen flex flex-col bg-mac-bg relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Title bar drag region */}
      {screen !== 'connection' && (
        <header className="drag-region h-12 flex items-center justify-between px-4 border-b border-mac-border shrink-0">
          <div className="flex items-center gap-2 pl-16">
            {screen !== 'home' && (
              <button
                onClick={() => navigate('home')}
                className="no-drag text-mac-muted hover:text-white text-sm transition-colors"
              >
                &larr; Home
              </button>
            )}
            <span className="text-sm font-medium text-white">Secretary</span>
          </div>
          <div className="flex items-center gap-3 no-drag">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-mac-success' : 'bg-mac-danger animate-pulse'
                }`}
              />
              <span className="text-[11px] text-mac-muted">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <button
              onClick={() => navigate('history')}
              className="no-drag text-[11px] text-mac-muted hover:text-white transition-colors"
            >
              History
            </button>
            <button
              onClick={handleDisconnect}
              className="text-[11px] text-mac-muted hover:text-mac-danger transition-colors"
            >
              Disconnect
            </button>
          </div>
        </header>
      )}

      {/* Screen content */}
      <main className="flex-1 overflow-hidden">
        {autoConnecting && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <img src={appIcon} alt="Secretary" className="w-16 h-16 rounded-2xl shadow-lg object-cover" />
            <div className="text-sm text-mac-muted">Connecting...</div>
            <div className="w-32 h-1 bg-mac-border rounded-full overflow-hidden">
              <div className="h-full bg-mac-accent rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}
        {!autoConnecting && screen === 'connection' && <ConnectionScreen onConnected={handleConnected} />}
        {screen === 'home' && <HomeScreen onNavigate={navigate} />}
        {screen === 'browser' && <FileBrowser remoteUser={remoteUser} />}
        {screen === 'send' && <SendScreen remoteUser={remoteUser} progress={progress} onClearProgress={() => setProgress(null)} />}
        {screen === 'receive' && <ReceiveScreen remoteUser={remoteUser} progress={progress} onClearProgress={() => setProgress(null)} />}
        {screen === 'status' && <StatusScreen />}
        {screen === 'history' && <HistoryScreen />}
      </main>
      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-40 bg-mac-accent/10 border-2 border-dashed border-mac-accent rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-mac-card rounded-mac px-8 py-6 mac-card text-center">
            <svg className="w-12 h-12 text-mac-accent mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <div className="text-sm font-semibold">Drop files to upload</div>
            <div className="text-xs text-mac-muted mt-1">Files will be sent to Mac Mini Desktop</div>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  )
}
