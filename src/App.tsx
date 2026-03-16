import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Screen, ConnectionProfile, TransferProgress } from './types'
import ConnectionListScreen from './components/ConnectionListScreen'
import HomeScreen from './components/HomeScreen'
import FileBrowser from './components/FileBrowser'
import SendScreen from './components/SendScreen'
import ReceiveScreen from './components/ReceiveScreen'
import StatusScreen from './components/StatusScreen'
import HistoryScreen, { addHistory } from './components/HistoryScreen'
import ToastContainer, { showToast } from './components/ui/Toast'
import appIcon from './assets/app-icon.png'

export default function App() {
  const [screen, setScreen] = useState<Screen>('connections')
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set())
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)
  const [progress, setProgress] = useState<TransferProgress | null>(null)
  const [autoConnecting, setAutoConnecting] = useState(true)

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeConnectionId) ?? null,
    [profiles, activeConnectionId]
  )
  const remoteUser = activeProfile?.username ?? ''

  // Progress listener — filter to active connection
  useEffect(() => {
    const cleanup = window.electronAPI.sftp.onProgress((p: TransferProgress) => {
      if (p.connectionId === activeConnectionId) {
        setProgress(p)
      }
    })
    return cleanup
  }, [activeConnectionId])

  // Load profiles + auto-connect on mount
  useEffect(() => {
    (async () => {
      try {
        let saved: ConnectionProfile[] | undefined = await window.electronAPI.settings.get('connectionProfiles')

        // Migration from old single-connection settings
        if (!saved || saved.length === 0) {
          const oldConn = await window.electronAPI.settings.get('connection')
          if (oldConn?.host && oldConn?.username) {
            const migrated: ConnectionProfile = {
              id: crypto.randomUUID(),
              name: oldConn.host,
              host: oldConn.host,
              port: oldConn.port || 22,
              username: oldConn.username,
              authType: oldConn.authType || 'key',
              privateKeyPath: oldConn.privateKeyPath,
            }
            saved = [migrated]
            await window.electronAPI.settings.set('connectionProfiles', saved)
          }
        }

        if (saved && saved.length > 0) {
          setProfiles(saved)

          // Auto-connect SSH key profiles
          for (const profile of saved) {
            if (profile.authType === 'password') continue
            const result = await window.electronAPI.ssh.connect(profile.id, {
              host: profile.host,
              port: profile.port,
              username: profile.username,
              authType: profile.authType,
              privateKeyPath: profile.privateKeyPath,
            })
            if (result.success) {
              setConnectedIds((prev) => new Set(prev).add(profile.id))
              if (!activeConnectionId) {
                setActiveConnectionId(profile.id)
                setScreen('home')
              }
            }
          }
        }
      } catch {
        // auto-connect failed
      } finally {
        setAutoConnecting(false)
      }
    })()
  }, [])

  // Auto-reconnect on unexpected disconnect
  useEffect(() => {
    const cleanup = window.electronAPI.ssh.onDisconnected(async (connectionId: string) => {
      setConnectedIds((prev) => {
        const next = new Set(prev)
        next.delete(connectionId)
        return next
      })

      const profile = profiles.find((p) => p.id === connectionId)
      const name = profile?.name || connectionId

      if (connectionId === activeConnectionId) {
        showToast('info', `"${name}" disconnected. Reconnecting...`)
        const result = await window.electronAPI.ssh.reconnect(connectionId)
        if (result.success) {
          setConnectedIds((prev) => new Set(prev).add(connectionId))
          showToast('success', `Reconnected to "${name}" (attempt ${result.attempt})`)
        } else {
          showToast('error', `Failed to reconnect to "${name}"`)
        }
      } else {
        showToast('info', `"${name}" disconnected`)
      }
    })
    return cleanup
  }, [activeConnectionId, profiles])

  const handleConnect = useCallback((profile: ConnectionProfile) => {
    setConnectedIds((prev) => new Set(prev).add(profile.id))
    setActiveConnectionId(profile.id)
    setScreen('home')
  }, [])

  const handleDisconnect = useCallback(async (connectionId?: string) => {
    const id = connectionId || activeConnectionId
    if (!id) return
    await window.electronAPI.ssh.disconnect(id)
    setConnectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (id === activeConnectionId) {
      // Switch to next connected profile or go to connections
      const remaining = [...connectedIds].filter((cid) => cid !== id)
      if (remaining.length > 0) {
        setActiveConnectionId(remaining[0])
      } else {
        setActiveConnectionId(null)
        setScreen('connections')
      }
    }
  }, [activeConnectionId, connectedIds])

  const handleProfilesChange = useCallback((newProfiles: ConnectionProfile[]) => {
    setProfiles(newProfiles)
    window.electronAPI.settings.set('connectionProfiles', newProfiles)
  }, [])

  const navigate = useCallback((s: Screen) => setScreen(s), [])

  // Global drag & drop upload
  const [dragging, setDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!activeConnectionId || !connectedIds.has(activeConnectionId)) return
    e.preventDefault()
    setDragging(true)
  }, [activeConnectionId, connectedIds])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (!activeConnectionId || !remoteUser) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const dest = `/Users/${remoteUser}/Desktop`
    showToast('info', `Uploading ${files.length} file(s)...`)

    let uploaded = 0
    for (const file of files) {
      try {
        await window.electronAPI.sftp.upload(activeConnectionId, file.path, `${dest}/${file.name}`)
        addHistory({ filename: file.name, direction: 'upload', success: true, connectionName: activeProfile?.name })
        uploaded++
      } catch (err: any) {
        showToast('error', `Failed to upload ${file.name}`)
        addHistory({ filename: file.name, direction: 'upload', success: false, error: err.message, connectionName: activeProfile?.name })
      }
    }
    if (uploaded > 0) showToast('success', `Uploaded ${uploaded} file(s)`)
  }, [activeConnectionId, remoteUser, activeProfile])

  // Connection switcher
  const connectedProfiles = useMemo(
    () => profiles.filter((p) => connectedIds.has(p.id)),
    [profiles, connectedIds]
  )

  return (
    <div
      className="h-screen flex flex-col bg-mac-bg relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Title bar */}
      {screen !== 'connections' && (
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
            {/* Connection switcher */}
            {connectedProfiles.length > 1 ? (
              <select
                value={activeConnectionId || ''}
                onChange={(e) => setActiveConnectionId(e.target.value)}
                className="bg-mac-input border border-mac-border rounded text-[11px] text-white px-2 py-1 focus:outline-none"
              >
                {connectedProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ) : activeProfile ? (
              <span className="text-[11px] text-mac-muted">{activeProfile.name}</span>
            ) : null}

            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                activeConnectionId && connectedIds.has(activeConnectionId) ? 'bg-mac-success' : 'bg-mac-danger animate-pulse'
              }`} />
              <span className="text-[11px] text-mac-muted">
                {connectedIds.size > 0 ? `${connectedIds.size} connected` : 'Disconnected'}
              </span>
            </div>
            <button
              onClick={() => navigate('history')}
              className="text-[11px] text-mac-muted hover:text-white transition-colors"
            >
              History
            </button>
            <button
              onClick={() => navigate('connections')}
              className="text-[11px] text-mac-muted hover:text-white transition-colors"
            >
              Connections
            </button>
            {activeConnectionId && (
              <button
                onClick={() => handleDisconnect()}
                className="text-[11px] text-mac-muted hover:text-mac-danger transition-colors"
              >
                Disconnect
              </button>
            )}
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
        {!autoConnecting && screen === 'connections' && (
          <ConnectionListScreen
            profiles={profiles}
            connectedIds={connectedIds}
            onProfilesChange={handleProfilesChange}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        )}
        {screen === 'home' && <HomeScreen onNavigate={navigate} activeProfile={activeProfile} />}
        {screen === 'browser' && activeConnectionId && (
          <FileBrowser connectionId={activeConnectionId} remoteUser={remoteUser} />
        )}
        {screen === 'send' && activeConnectionId && (
          <SendScreen connectionId={activeConnectionId} remoteUser={remoteUser} connectionName={activeProfile?.name} progress={progress} onClearProgress={() => setProgress(null)} />
        )}
        {screen === 'receive' && activeConnectionId && (
          <ReceiveScreen connectionId={activeConnectionId} remoteUser={remoteUser} connectionName={activeProfile?.name} progress={progress} onClearProgress={() => setProgress(null)} />
        )}
        {screen === 'status' && activeConnectionId && (
          <StatusScreen connectionId={activeConnectionId} />
        )}
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
            <div className="text-xs text-mac-muted mt-1">Files will be sent to {activeProfile?.name || 'remote'} Desktop</div>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  )
}
