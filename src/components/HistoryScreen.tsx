import { useState, useEffect, useCallback } from 'react'

export interface TransferRecord {
  id: number
  timestamp: string
  filename: string
  direction: 'upload' | 'download'
  success: boolean
  error?: string
  connectionName?: string
}

let historyId = 0
const history: TransferRecord[] = []
let listeners: Array<() => void> = []

export function addHistory(record: Omit<TransferRecord, 'id' | 'timestamp'>) {
  history.unshift({
    ...record,
    id: ++historyId,
    timestamp: new Date().toISOString(),
  })
  // Keep last 100
  if (history.length > 100) history.pop()
  listeners.forEach((fn) => fn())
}

export function getHistory(): TransferRecord[] {
  return history
}

export default function HistoryScreen() {
  const [records, setRecords] = useState<TransferRecord[]>(getHistory())

  useEffect(() => {
    const handler = () => setRecords([...getHistory()])
    listeners.push(handler)
    return () => {
      const idx = listeners.indexOf(handler)
      if (idx !== -1) listeners.splice(idx, 1)
    }
  }, [])

  const clearHistory = useCallback(() => {
    history.length = 0
    listeners.forEach((fn) => fn())
  }, [])

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <svg className="w-6 h-6 text-mac-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Transfer History
        </h2>
        {records.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs text-mac-muted hover:text-mac-danger transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-mac-input border border-mac-border rounded-lg">
        {records.length > 0 ? (
          records.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-mac-border/30 last:border-0"
            >
              {/* Direction icon */}
              <div className={`shrink-0 ${r.success ? 'text-mac-accent' : 'text-mac-danger'}`}>
                {r.direction === 'upload' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{r.filename}</div>
                <div className="text-[10px] text-mac-muted">
                  {r.direction === 'upload' ? 'Sent' : 'Received'}
                  {r.connectionName && <span className="text-mac-accent ml-1">({r.connectionName})</span>}
                  {!r.success && r.error && <span className="text-mac-danger ml-1">— {r.error}</span>}
                </div>
              </div>

              {/* Status + time */}
              <div className="text-right shrink-0">
                <div className={`text-[10px] font-medium ${r.success ? 'text-mac-success' : 'text-mac-danger'}`}>
                  {r.success ? 'OK' : 'Failed'}
                </div>
                <div className="text-[10px] text-mac-muted">
                  {new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-mac-muted text-sm">
            No transfer history yet
          </div>
        )}
      </div>
    </div>
  )
}
