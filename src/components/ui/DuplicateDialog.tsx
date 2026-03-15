interface Props {
  filename: string
  onOverwrite: () => void
  onSkip: () => void
  onRename: () => void
}

export default function DuplicateDialog({ filename, onOverwrite, onSkip, onRename }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mac-card bg-mac-card rounded-mac p-6 w-full max-w-sm">
        <h3 className="text-base font-bold mb-2">File Already Exists</h3>
        <p className="text-sm text-mac-muted mb-1">
          <code className="text-white bg-mac-border rounded px-1">{filename}</code>
        </p>
        <p className="text-sm text-mac-muted mb-6">already exists at the destination.</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onOverwrite}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-mac-accent hover:bg-blue-600 transition-colors"
          >
            Overwrite
          </button>
          <button
            onClick={onRename}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-mac-border hover:bg-mac-hover transition-colors"
          >
            Keep Both (rename)
          </button>
          <button
            onClick={onSkip}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium text-mac-muted hover:text-white transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
