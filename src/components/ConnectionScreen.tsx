import { useState, useEffect } from 'react'
import type { ConnectionConfig } from '../types'
import appIcon from '../assets/app-icon.png'

interface Props {
  onConnected: (username: string) => void
}

/** Red highlighted placeholder for user-specific values */
function V({ children }: { children: string }) {
  return (
    <code className="text-red-400 bg-red-400/10 border border-red-400/30 rounded px-1 font-mono text-[11px]">
      {children}
    </code>
  )
}

function GuidePanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="mac-card bg-mac-card rounded-mac p-6 w-full max-w-md no-drag overflow-y-auto max-h-[85vh]">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold">Connection Guide</h2>
        <button
          onClick={onClose}
          className="text-mac-muted hover:text-white transition-colors text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <div className="space-y-5 text-sm text-gray-300 leading-relaxed">
        {/* Overview */}
        <section>
          <h3 className="text-mac-accent font-semibold text-xs uppercase tracking-wider mb-2">
            Overview
          </h3>
          <p className="text-mac-muted text-xs">
            Secretary is a GUI tool that uses <span className="text-white">Tailscale + SSH</span> to connect to your Mac Mini remotely.
            Your MacBook connects one-way to the Mac Mini — the Mac Mini cannot access your MacBook.
          </p>
        </section>

        {/* Network diagram */}
        <section className="bg-mac-input border border-mac-border rounded-lg p-4">
          <div className="text-xs text-center space-y-2">
            <div className="flex items-center justify-center gap-3">
              <div className="bg-mac-border rounded-lg px-3 py-1.5">
                <div className="font-semibold text-white">Your MacBook</div>
                <div className="text-mac-muted text-[10px]"><V>MACHINE_NAME</V></div>
              </div>
              <div className="text-mac-accent font-mono">&rarr;</div>
              <div className="bg-mac-border rounded-lg px-3 py-1.5">
                <div className="font-semibold text-white">Remote Mac Mini</div>
                <div className="text-mac-muted text-[10px]"><V>MACHINE_NAME</V></div>
              </div>
            </div>
            <div className="text-mac-muted text-[10px] flex items-center justify-center gap-1">
              <span className="text-mac-success">&#10003;</span> MacBook &rarr; Mac Mini allowed
            </div>
            <div className="text-mac-muted text-[10px] flex items-center justify-center gap-1">
              <span className="text-mac-danger">&#10007;</span> Mac Mini &rarr; MacBook blocked
            </div>
          </div>
        </section>

        {/* Field explanations */}
        <section>
          <h3 className="text-mac-accent font-semibold text-xs uppercase tracking-wider mb-3">
            Each field explained
          </h3>
          {/* Important notice */}
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3">
            <p className="text-yellow-400 text-xs font-medium">
              HOST, USER, PASSWORD are all <span className="underline">Mac Mini</span> information.<br />
              NOT your MacBook's!
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-mac-input border border-mac-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="font-semibold text-white text-xs">HOST</div>
                <span className="text-[9px] bg-mac-accent/20 text-mac-accent rounded px-1">Mac Mini info</span>
              </div>
              <p className="text-mac-muted text-xs">
                The Tailscale machine name of your Mac Mini.<br />
                Example: <V>YOUR_MACHINE_NAME</V><br />
                Check it in the Tailscale app &gt; Machines list.
              </p>
            </div>

            <div className="bg-mac-input border border-mac-border rounded-lg p-3">
              <div className="font-semibold text-white text-xs mb-1">PORT</div>
              <p className="text-mac-muted text-xs">
                SSH port number. Default is <code className="text-mac-accent bg-mac-border rounded px-1">22</code>.<br />
                Don't change it unless you specifically configured a different port.
              </p>
            </div>

            <div className="bg-mac-input border border-mac-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="font-semibold text-white text-xs">USER</div>
                <span className="text-[9px] bg-mac-accent/20 text-mac-accent rounded px-1">Mac Mini info</span>
              </div>
              <p className="text-mac-muted text-xs">
                The macOS user account name on the Mac Mini.<br />
                Example: <V>REMOTE_USERNAME</V><br />
                <span className="text-yellow-400">NOT your MacBook username! Enter the account name used on the Mac Mini.</span><br />
                To check: Mac Mini &gt; System Settings &gt; Users &amp; Groups
              </p>
            </div>

            <div className="bg-mac-input border border-mac-border rounded-lg p-3">
              <div className="font-semibold text-white text-xs mb-1">SSH KEY vs PASSWORD</div>
              <p className="text-mac-muted text-xs">
                Choose how to authenticate with the Mac Mini.
              </p>
              <div className="mt-2 space-y-1.5">
                <div className="text-mac-muted text-xs">
                  <span className="text-white font-medium">SSH Key</span> — Uses a cryptographic key file stored on your MacBook. More secure, no password needed each time.<br />
                  Default path: <code className="text-mac-accent bg-mac-border rounded px-1">~/.ssh/id_ed25519</code>
                </div>
                <div className="text-mac-muted text-xs">
                  <span className="text-white font-medium">Password</span> — <span className="text-yellow-400">The login password you use when turning on the Mac Mini.</span> Simpler but less secure.
                </div>
              </div>
            </div>

            <div className="bg-mac-input border border-mac-border rounded-lg p-3">
              <div className="font-semibold text-white text-xs mb-1">SSH KEY PATH (Browse)</div>
              <p className="text-mac-muted text-xs">
                The location of your SSH private key file on this MacBook.<br />
                Default: <code className="text-mac-accent bg-mac-border rounded px-1">~/.ssh/id_ed25519</code><br />
                If you haven't set up an SSH key yet, you can generate one by opening Terminal and running:<br />
                <code className="text-mac-accent bg-mac-border rounded px-1 mt-1 inline-block">ssh-keygen -t ed25519</code><br />
                Then copy it to the Mac Mini:<br />
                <code className="text-mac-accent bg-mac-border rounded px-1 mt-1 inline-block">ssh-copy-id <V>REMOTE_USERNAME</V>@<V>YOUR_MACHINE_NAME</V></code>
              </p>
            </div>
          </div>
        </section>

        {/* Prerequisites */}
        <section>
          <h3 className="text-mac-accent font-semibold text-xs uppercase tracking-wider mb-3">
            Before connecting — checklist
          </h3>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs text-mac-muted">
              <span className="text-mac-accent mt-0.5 shrink-0">1.</span>
              <span>Both MacBook and Mac Mini must have <span className="text-white">Tailscale installed and logged in</span> with the same account (<V>YOUR_EMAIL</V>)</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-mac-muted">
              <span className="text-mac-accent mt-0.5 shrink-0">2.</span>
              <span>On Mac Mini: <span className="text-white">System Settings &rarr; General &rarr; Sharing &rarr; Remote Login</span> must be enabled</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-mac-muted">
              <span className="text-mac-accent mt-0.5 shrink-0">3.</span>
              <span>Tailscale ACL must be configured for one-way access (tag:personal &rarr; tag:secretary)</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-mac-muted">
              <span className="text-mac-accent mt-0.5 shrink-0">4.</span>
              <span>Mac Mini's <span className="text-white">Exit Node</span> and <span className="text-white">Allow Local Network Access</span> should both be <span className="text-yellow-400">disabled</span></span>
            </div>
          </div>
        </section>

        {/* Troubleshooting */}
        <section>
          <h3 className="text-mac-accent font-semibold text-xs uppercase tracking-wider mb-3">
            Troubleshooting
          </h3>
          <div className="space-y-2 text-xs text-mac-muted">
            <div className="bg-mac-input border border-mac-border rounded-lg p-3">
              <div className="text-white font-medium mb-1">Connection timed out?</div>
              <p>Check if Tailscale is running on both machines. Open the Tailscale menu bar app and verify both devices are online.</p>
            </div>
            <div className="bg-mac-input border border-mac-border rounded-lg p-3">
              <div className="text-white font-medium mb-1">Permission denied?</div>
              <p>Make sure USER is the <span className="text-red-400">Mac Mini's username</span>, not your MacBook's. Also check that your SSH key or password is correct.</p>
            </div>
            <div className="bg-mac-input border border-mac-border rounded-lg p-3">
              <div className="text-white font-medium mb-1">Key file not found?</div>
              <p>Click "Browse" to manually locate your SSH key, or switch to Password authentication if you haven't set up SSH keys.</p>
            </div>
          </div>
        </section>

        {/* Download full guide */}
        <section className="pt-2">
          <button
            onClick={async () => {
              await window.electronAPI.app.saveDocFile('tailscale-guide.docx')
            }}
            className="w-full bg-mac-input border border-mac-border hover:border-mac-accent/50 transition-all py-2.5 rounded-lg text-xs text-mac-muted hover:text-white flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Full Guide (tailscale-guide.docx)
          </button>
        </section>
      </div>
    </div>
  )
}

export default function ConnectionScreen({ onConnected }: Props) {
  const [config, setConfig] = useState<ConnectionConfig>({
    host: '',
    port: 22,
    username: '',
    authType: 'key',
    privateKeyPath: '~/.ssh/id_ed25519',
    password: '',
  })
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error'>('idle')
  const [error, setError] = useState('')
  const [showGuide, setShowGuide] = useState(false)

  // Load saved connection settings
  useEffect(() => {
    window.electronAPI.settings.get('connection').then((saved: Partial<ConnectionConfig>) => {
      if (saved) {
        setConfig((prev) => ({ ...prev, ...saved }))
      }
    })
  }, [])

  const handleConnect = async () => {
    setStatus('connecting')
    setError('')

    const result = await window.electronAPI.ssh.connect(config)

    if (result.success) {
      await window.electronAPI.settings.set('connection', {
        host: config.host,
        port: config.port,
        username: config.username,
        authType: config.authType,
        privateKeyPath: config.privateKeyPath,
      })
      setStatus('idle')
      onConnected(config.username)
    } else {
      setStatus('error')
      setError(result.error || 'Connection failed')
    }
  }

  const handleBrowseKey = async () => {
    const result = await window.electronAPI.dialog.openFile({ defaultPath: '~/.ssh' })
    if (!result.canceled && result.filePaths[0]) {
      setConfig((prev) => ({ ...prev, privateKeyPath: result.filePaths[0] }))
    }
  }

  return (
    <div className="flex items-center justify-center h-full drag-region gap-6 px-8">
      {/* Connection Form */}
      <div className="mac-card bg-mac-card rounded-mac p-8 flex flex-col items-center w-full max-w-sm no-drag">
        {/* App Icon */}
        <div className="text-center mb-8">
          <img
            src={appIcon}
            alt="Secretary"
            className="w-20 h-20 rounded-2xl shadow-lg mx-auto mb-4 object-cover"
          />
          <h1 className="text-2xl font-bold tracking-tight">Secretary</h1>
          <p className="text-mac-muted text-sm mt-1">Mac Mini File Manager</p>
        </div>

        {/* Connection Form */}
        <form
          className="w-full space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            handleConnect()
          }}
        >
          {/* Host & Port */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="block text-[10px] uppercase font-semibold text-mac-muted mb-1 ml-1">
                Host
              </label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => setConfig((p) => ({ ...p, host: e.target.value }))}
                className="w-full bg-mac-input border border-mac-border rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-mac-accent focus:border-mac-accent"
                placeholder="YOUR_MACHINE_NAME"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-[10px] uppercase font-semibold text-mac-muted mb-1 ml-1">
                Port
              </label>
              <input
                type="text"
                value={config.port}
                onChange={(e) => setConfig((p) => ({ ...p, port: parseInt(e.target.value) || 22 }))}
                className="w-full bg-mac-input border border-mac-border rounded-lg text-sm text-white px-3 py-2 text-center focus:outline-none focus:ring-1 focus:ring-mac-accent focus:border-mac-accent"
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
              value={config.username}
              onChange={(e) => setConfig((p) => ({ ...p, username: e.target.value }))}
              className="w-full bg-mac-input border border-mac-border rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-mac-accent focus:border-mac-accent"
              placeholder="REMOTE_USERNAME"
            />
          </div>

          {/* Auth Toggle */}
          <div className="bg-mac-input p-1 rounded-lg flex border border-mac-border">
            <button
              type="button"
              onClick={() => setConfig((p) => ({ ...p, authType: 'key' }))}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                config.authType === 'key'
                  ? 'bg-mac-border shadow-sm text-white'
                  : 'text-mac-muted hover:text-white'
              }`}
            >
              SSH Key
            </button>
            <button
              type="button"
              onClick={() => setConfig((p) => ({ ...p, authType: 'password' }))}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                config.authType === 'password'
                  ? 'bg-mac-border shadow-sm text-white'
                  : 'text-mac-muted hover:text-white'
              }`}
            >
              Password
            </button>
          </div>

          {/* SSH Key / Password */}
          {config.authType === 'key' ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={config.privateKeyPath}
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
          ) : (
            <div>
              <input
                type="password"
                value={config.password}
                onChange={(e) => setConfig((p) => ({ ...p, password: e.target.value }))}
                className="w-full bg-mac-input border border-mac-border rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-mac-accent focus:border-mac-accent"
                placeholder="Enter password"
              />
            </div>
          )}

          {/* Error Message */}
          {status === 'error' && (
            <div className="text-mac-danger text-xs text-center py-1">{error}</div>
          )}

          {/* Buttons */}
          <div className="pt-4 space-y-2">
            <button
              type="submit"
              disabled={status === 'connecting'}
              className="w-full bg-mac-accent hover:bg-blue-600 active:scale-[0.98] transition-all py-2.5 rounded-mac font-semibold text-sm shadow-lg disabled:opacity-50"
            >
              {status === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>

            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full bg-mac-input border border-mac-border hover:border-mac-accent/50 transition-all py-2 rounded-mac text-xs text-mac-muted hover:text-white flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {showGuide ? 'Hide Guide' : 'Need help? View Guide'}
            </button>
          </div>

          {/* Status */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : status === 'error'
                  ? 'bg-mac-danger'
                  : 'bg-mac-danger animate-pulse'
              }`}
            />
            <span className="text-[11px] text-mac-muted font-medium">
              {status === 'connecting'
                ? 'Connecting...'
                : status === 'error'
                ? 'Connection Failed'
                : 'Disconnected'}
            </span>
          </div>
        </form>
      </div>

      {/* Guide Panel */}
      {showGuide && <GuidePanel onClose={() => setShowGuide(false)} />}
    </div>
  )
}
