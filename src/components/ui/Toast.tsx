import { useState, useEffect, useCallback } from 'react'

export interface ToastMessage {
  id: number
  type: 'success' | 'error' | 'info'
  text: string
}

let toastId = 0
let listeners: Array<(msg: ToastMessage) => void> = []

// Deduplication: track recent toasts to prevent spam
const recentToasts = new Map<string, number>()
const DEDUP_INTERVAL = 3000

export function showToast(type: ToastMessage['type'], text: string) {
  const key = `${type}:${text}`
  const now = Date.now()
  const lastShown = recentToasts.get(key)
  if (lastShown && now - lastShown < DEDUP_INTERVAL) return

  recentToasts.set(key, now)
  // Clean old entries
  for (const [k, t] of recentToasts) {
    if (now - t > DEDUP_INTERVAL) recentToasts.delete(k)
  }

  const msg: ToastMessage = { id: ++toastId, type, text }
  listeners.forEach((fn) => fn(msg))
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setToasts((prev) => [...prev, msg])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id))
      }, 3500)
    }
    listeners.push(handler)
    return () => {
      const idx = listeners.indexOf(handler)
      if (idx !== -1) listeners.splice(idx, 1)
    }
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`px-4 py-3 rounded-lg text-sm font-medium shadow-2xl cursor-pointer transition-all animate-slide-up border ${
            t.type === 'success'
              ? 'bg-mac-success/15 border-mac-success/30 text-mac-success'
              : t.type === 'error'
              ? 'bg-mac-danger/15 border-mac-danger/30 text-mac-danger'
              : 'bg-mac-accent/15 border-mac-accent/30 text-mac-accent'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
