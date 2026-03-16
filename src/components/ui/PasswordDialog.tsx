import { useState } from 'react'

interface Props {
  profileName: string
  onSubmit: (password: string) => void
  onCancel: () => void
}

export default function PasswordDialog({ profileName, onSubmit, onCancel }: Props) {
  const [password, setPassword] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="mac-card bg-mac-card rounded-mac p-6 w-full max-w-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold mb-1">Enter Password</h3>
        <p className="text-xs text-mac-muted mb-4">{profileName}</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && password && onSubmit(password)}
          className="w-full bg-mac-input border border-mac-border rounded-lg text-sm text-white px-3 py-2 mb-4 focus:outline-none focus:ring-1 focus:ring-mac-accent"
          placeholder="Password"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-mac-border hover:bg-mac-hover py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => password && onSubmit(password)}
            disabled={!password}
            className="flex-1 bg-mac-accent hover:bg-blue-600 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  )
}
