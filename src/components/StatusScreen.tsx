import { useState, useEffect, useCallback } from 'react'
import { showToast } from './ui/Toast'

interface DiskInfo {
  filesystem: string
  size: string
  used: string
  available: string
  usePercent: number
  mounted: string
}

export default function StatusScreen() {
  const [connected, setConnected] = useState(true)
  const [disks, setDisks] = useState<DiskInfo[]>([])
  const [uptime, setUptime] = useState('')
  const [hostname, setHostname] = useState('')
  const [osVersion, setOsVersion] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const status = await window.electronAPI.ssh.status()
      setConnected(status.connected)

      if (!status.connected) return

      // Disk usage — macOS df -h has 9 columns:
      // Filesystem Size Used Avail Capacity iused ifree %iused Mounted
      const dfOutput = await window.electronAPI.ssh.exec('df -h')
      const lines = dfOutput.trim().split('\n').slice(1)
      const parsed: DiskInfo[] = lines
        .map((line) => {
          const parts = line.split(/\s+/)
          if (parts.length < 9) {
            // Linux style: Filesystem Size Used Avail Use% Mounted
            if (parts.length >= 6) {
              const useStr = parts[4].replace('%', '')
              return {
                filesystem: parts[0],
                size: parts[1],
                used: parts[2],
                available: parts[3],
                usePercent: parseInt(useStr) || 0,
                mounted: parts[5],
              }
            }
            return null
          }
          // macOS style
          const capacityStr = parts[4].replace('%', '')
          const mounted = parts.slice(8).join(' ')
          return {
            filesystem: parts[0],
            size: parts[1],
            used: parts[2],
            available: parts[3],
            usePercent: parseInt(capacityStr) || 0,
            mounted,
          }
        })
        .filter((d): d is DiskInfo =>
          d !== null &&
          d.usePercent > 0 &&
          (d.mounted === '/' || d.mounted === '/System/Volumes/Data')
        )

      setDisks(parsed)

      // Hostname
      const hostnameOutput = await window.electronAPI.ssh.exec('hostname')
      setHostname(hostnameOutput.trim())

      // Uptime
      const uptimeOutput = await window.electronAPI.ssh.exec('uptime')
      setUptime(uptimeOutput.trim())

      // OS version
      const osOutput = await window.electronAPI.ssh.exec('sw_vers -productVersion 2>/dev/null || echo "N/A"')
      setOsVersion(osOutput.trim())
    } catch (err: any) {
      showToast('error', `Status fetch failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="mac-card bg-mac-card rounded-mac p-8 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-mac-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          System Status
        </h2>

        {loading ? (
          <div className="text-center text-mac-muted text-sm py-8">Loading...</div>
        ) : (
          <div className="space-y-5">
            {/* Connection & Host */}
            <div className="bg-mac-input border border-mac-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-mac-muted uppercase">Connection</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${connected ? 'bg-mac-success' : 'bg-mac-danger'}`} />
                  <span className="text-xs text-mac-muted">{connected ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
              {hostname && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-mac-muted">Hostname</span>
                  <span className="text-xs text-white font-medium">{hostname}</span>
                </div>
              )}
              {osVersion && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-mac-muted">macOS</span>
                  <span className="text-xs text-white font-medium">{osVersion}</span>
                </div>
              )}
            </div>

            {/* Disk Usage */}
            {disks.length > 0 ? (
              disks.map((disk, i) => (
                <div key={i} className="bg-mac-input border border-mac-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-mac-muted uppercase">Disk ({disk.mounted})</span>
                    <span className="text-xs text-mac-muted">{disk.used} / {disk.size}</span>
                  </div>
                  <div className="w-full bg-mac-border rounded-full h-3 mb-1.5">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        disk.usePercent > 90 ? 'bg-mac-danger' : disk.usePercent > 70 ? 'bg-yellow-500' : 'bg-mac-accent'
                      }`}
                      style={{ width: `${disk.usePercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-mac-muted">
                    <span>{disk.usePercent}% used</span>
                    <span>{disk.available} available</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-mac-input border border-mac-border rounded-lg p-4 text-xs text-mac-muted text-center">
                No disk info available
              </div>
            )}

            {/* Uptime */}
            <div className="bg-mac-input border border-mac-border rounded-lg p-4">
              <span className="text-xs font-semibold text-mac-muted uppercase block mb-1">Uptime</span>
              <span className="text-sm text-white">{uptime || 'N/A'}</span>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchStatus}
              className="w-full bg-mac-border hover:bg-mac-hover transition-colors py-2 rounded-lg text-sm font-medium"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
