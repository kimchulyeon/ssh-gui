import { useState, useCallback } from 'react'
import type { ConnectionConfig, ConnectionProfile } from '../types'
import { showToast } from './ui/Toast'
import ConfirmDialog from './ui/ConfirmDialog'
import PasswordDialog from './ui/PasswordDialog'
import appIcon from '../assets/app-icon.png'

interface Props {
  profiles: ConnectionProfile[]
  connectedIds: Set<string>
  onProfilesChange: (profiles: ConnectionProfile[]) => void
  onConnect: (profile: ConnectionProfile) => void
  onDisconnect: (connectionId: string) => void
}

const EMPTY_FORM = {
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'key' as const,
  privateKeyPath: '~/.ssh/id_ed25519',
  password: '',
}

export default function ConnectionListScreen({
  profiles,
  connectedIds,
  onProfilesChange,
  onConnect,
  onDisconnect,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null) // profile id or 'new'
  const [form, setForm] = useState(EMPTY_FORM)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConnectionProfile | null>(null)
  const [passwordPrompt, setPasswordPrompt] = useState<ConnectionProfile | null>(null)

  const startNew = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditing('new')
  }, [])

  const startEdit = useCallback((profile: ConnectionProfile) => {
    setForm({
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authType: profile.authType,
      privateKeyPath: profile.privateKeyPath || '~/.ssh/id_ed25519',
      password: '',
    })
    setEditing(profile.id)
  }, [])

  const handleSave = useCallback(() => {
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
      showToast('error', 'Name, Host, and User are required')
      return
    }

    if (editing === 'new') {
      const newProfile: ConnectionProfile = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        host: form.host.trim(),
        port: form.port,
        username: form.username.trim(),
        authType: form.authType,
        privateKeyPath: form.authType === 'key' ? form.privateKeyPath : undefined,
      }
      onProfilesChange([...profiles, newProfile])
      showToast('success', `Added "${newProfile.name}"`)
    } else if (editing) {
      const updated = profiles.map((p) =>
        p.id === editing
          ? {
              ...p,
              name: form.name.trim(),
              host: form.host.trim(),
              port: form.port,
              username: form.username.trim(),
              authType: form.authType,
              privateKeyPath: form.authType === 'key' ? form.privateKeyPath : undefined,
            }
          : p
      )
      onProfilesChange(updated)
      showToast('success', `Updated "${form.name.trim()}"`)
    }
    setEditing(null)
  }, [editing, form, profiles, onProfilesChange])

  const handleDelete = useCallback((profile: ConnectionProfile) => {
    if (connectedIds.has(profile.id)) {
      onDisconnect(profile.id)
    }
    onProfilesChange(profiles.filter((p) => p.id !== profile.id))
    setDeleteTarget(null)
    showToast('success', `Deleted "${profile.name}"`)
  }, [profiles, connectedIds, onProfilesChange, onDisconnect])

  const handleConnect = useCallback(async (profile: ConnectionProfile, password?: string) => {
    if (profile.authType === 'password' && !password) {
      setPasswordPrompt(profile)
      return
    }

    setConnecting(profile.id)
    const config: ConnectionConfig = {
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authType: profile.authType,
      privateKeyPath: profile.privateKeyPath,
      password,
    }

    const result = await window.electronAPI.ssh.connect(profile.id, config)
    setConnecting(null)

    if (result.success) {
      showToast('success', `Connected to "${profile.name}"`)
      onConnect(profile)
    } else {
      showToast('error', result.error || 'Connection failed')
    }
  }, [onConnect])

  const handleBrowseKey = useCallback(async () => {
    const result = await window.electronAPI.dialog.openFile({ defaultPath: '~/.ssh' })
    if (!result.canceled && result.filePaths[0]) {
      setForm((prev) => ({ ...prev, privateKeyPath: result.filePaths[0] }))
    }
  }, [])

  return (
    <div className="h-full flex drag-region">
      {/* Left: Profile list */}
      <div className="w-72 border-r border-mac-border flex flex-col no-drag">
        {/* Header — pt-8 for macOS traffic light buttons */}
        <div className="drag-region pt-8 px-4 pb-4 border-b border-mac-border flex items-center gap-3">
          <img src={appIcon} alt="Secretary" className="w-10 h-10 rounded-xl object-cover" />
          <div>
            <div className="text-sm font-bold">Secretary</div>
            <div className="text-[10px] text-mac-muted">{profiles.length} profile(s)</div>
          </div>
        </div>

        {/* Profile list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {profiles.map((profile) => {
            const isConnected = connectedIds.has(profile.id)
            const isConnecting = connecting === profile.id
            return (
              <div
                key={profile.id}
                onClick={() => {
                  if (isConnected) {
                    onConnect(profile) // already connected — go to home
                  } else if (!isConnecting) {
                    handleConnect(profile) // try connecting
                  }
                }}
                className={`rounded-lg p-3 transition-colors cursor-pointer ${
                  editing === profile.id ? 'bg-mac-accent/20 border border-mac-accent/30' : 'hover:bg-mac-border/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    isConnecting ? 'bg-yellow-500 animate-pulse' : isConnected ? 'bg-mac-success' : 'bg-mac-muted'
                  }`} />
                  <span className="text-sm font-medium truncate flex-1">{profile.name}</span>
                </div>
                <div className="text-[10px] text-mac-muted ml-4 truncate">
                  {profile.username}@{profile.host}:{profile.port}
                </div>
                <div className="flex gap-1.5 mt-2 ml-4" onClick={(e) => e.stopPropagation()}>
                  {isConnected ? (
                    <button
                      onClick={() => onDisconnect(profile.id)}
                      className="text-[10px] text-mac-danger hover:text-red-400 transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(profile)}
                      disabled={isConnecting}
                      className="text-[10px] text-mac-accent hover:text-blue-400 transition-colors disabled:opacity-50"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                  <span className="text-mac-border">|</span>
                  <button
                    onClick={() => startEdit(profile)}
                    className="text-[10px] text-mac-muted hover:text-white transition-colors"
                  >
                    Edit
                  </button>
                  <span className="text-mac-border">|</span>
                  <button
                    onClick={() => setDeleteTarget(profile)}
                    className="text-[10px] text-mac-muted hover:text-mac-danger transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}

          {profiles.length === 0 && (
            <div className="text-center text-mac-muted text-sm py-8">
              No saved connections.<br />Click "Add Connection" to get started.
            </div>
          )}
        </div>

        {/* Add button */}
        <div className="p-3 border-t border-mac-border">
          <button
            onClick={startNew}
            className="w-full bg-mac-accent hover:bg-blue-600 active:scale-[0.98] transition-all py-2 rounded-lg text-sm font-semibold"
          >
            + Add Connection
          </button>
        </div>
      </div>

      {/* Right: Edit form or empty state */}
      <div className="flex-1 flex items-center justify-center p-8 no-drag">
        {editing ? (
          <div className="mac-card bg-mac-card rounded-mac p-8 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-6">
              {editing === 'new' ? 'New Connection' : 'Edit Connection'}
            </h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] uppercase font-semibold text-mac-muted mb-1 ml-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full bg-mac-input border border-mac-border rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-mac-accent"
                  placeholder="My Mac Mini"
                />
              </div>

              {/* Host & Port */}
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <label className="block text-[10px] uppercase font-semibold text-mac-muted mb-1 ml-1">
                    Host
                  </label>
                  <input
                    type="text"
                    value={form.host}
                    onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                    className="w-full bg-mac-input border border-mac-border rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-mac-accent"
                    placeholder="YOUR_MACHINE_NAME"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] uppercase font-semibold text-mac-muted mb-1 ml-1">
                    Port
                  </label>
                  <input
                    type="text"
                    value={form.port}
                    onChange={(e) => setForm((p) => ({ ...p, port: parseInt(e.target.value) || 22 }))}
                    className="w-full bg-mac-input border border-mac-border rounded-lg text-sm text-white px-3 py-2 text-center focus:outline-none focus:ring-1 focus:ring-mac-accent"
                    placeholder="22"
                  />
                </div>
              </div>

              {/* User */}
              <div>
                <label className="block text-[10px] uppercase font-semibold text-mac-muted mb-1 ml-1">
                  User
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  className="w-full bg-mac-input border border-mac-border rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-mac-accent"
                  placeholder="REMOTE_USERNAME"
                />
              </div>

              {/* Auth Toggle */}
              <div className="bg-mac-input p-1 rounded-lg flex border border-mac-border">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, authType: 'key' }))}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                    form.authType === 'key' ? 'bg-mac-border shadow-sm text-white' : 'text-mac-muted hover:text-white'
                  }`}
                >
                  SSH Key
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, authType: 'password' }))}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                    form.authType === 'password' ? 'bg-mac-border shadow-sm text-white' : 'text-mac-muted hover:text-white'
                  }`}
                >
                  Password
                </button>
              </div>

              {/* SSH Key Path */}
              {form.authType === 'key' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.privateKeyPath}
                    readOnly
                    className="flex-1 bg-mac-input border border-mac-border rounded-lg text-xs text-white px-3 py-2 overflow-hidden text-ellipsis"
                    placeholder="~/.ssh/id_rsa"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseKey}
                    className="bg-mac-border hover:bg-mac-hover px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                  >
                    Browse
                  </button>
                </div>
              )}

              {form.authType === 'password' && (
                <p className="text-[10px] text-mac-muted">
                  Password will be prompted when connecting.
                </p>
              )}

              {/* Buttons */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 bg-mac-border hover:bg-mac-hover py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 bg-mac-accent hover:bg-blue-600 active:scale-[0.98] transition-all py-2 rounded-lg text-sm font-semibold"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-mac-muted">
            <img src={appIcon} alt="Secretary" className="w-20 h-20 rounded-2xl shadow-lg mx-auto mb-4 object-cover" />
            <h1 className="text-2xl font-bold text-white mb-1">Secretary</h1>
            <p className="text-sm">Select a connection or add a new one</p>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Connection"
          message={`Are you sure you want to delete "${deleteTarget.name}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Password prompt */}
      {passwordPrompt && (
        <PasswordDialog
          profileName={passwordPrompt.name}
          onSubmit={(pw) => {
            setPasswordPrompt(null)
            handleConnect(passwordPrompt, pw)
          }}
          onCancel={() => setPasswordPrompt(null)}
        />
      )}
    </div>
  )
}
