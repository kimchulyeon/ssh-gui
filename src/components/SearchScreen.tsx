import { useState, useCallback } from 'react'
import { showToast } from './ui/Toast'

interface Props {
  remoteUser: string
}

interface SearchResult {
  path: string
  name: string
  isDirectory: boolean
}

type FileTypeFilter = 'all' | 'documents' | 'images' | 'code' | 'media'
type DateFilter = 'all' | '1' | '7' | '30'

const FILE_TYPE_EXTENSIONS: Record<FileTypeFilter, string> = {
  all: '',
  documents: '\\( -name "*.pdf" -o -name "*.doc*" -o -name "*.xls*" -o -name "*.ppt*" -o -name "*.txt" -o -name "*.md" -o -name "*.rtf" \\)',
  images: '\\( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.svg" -o -name "*.webp" -o -name "*.heic" \\)',
  code: '\\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.swift" -o -name "*.rs" -o -name "*.go" -o -name "*.java" -o -name "*.css" -o -name "*.html" -o -name "*.json" \\)',
  media: '\\( -name "*.mp4" -o -name "*.mov" -o -name "*.mp3" -o -name "*.wav" -o -name "*.m4a" -o -name "*.avi" \\)',
}

export default function SearchScreen({ remoteUser }: Props) {
  const [query, setQuery] = useState('')
  const [searchPath, setSearchPath] = useState(`/Users/${remoteUser}`)
  const [fileType, setFileType] = useState<FileTypeFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set())

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    setSelectedResults(new Set())

    try {
      let cmd = `find ${searchPath} -maxdepth 5`

      // Name filter
      if (fileType === 'all') {
        cmd += ` -iname "*${query}*"`
      } else {
        cmd += ` ${FILE_TYPE_EXTENSIONS[fileType]} -iname "*${query}*"`
      }

      // Date filter
      if (dateFilter !== 'all') {
        cmd += ` -mtime -${dateFilter}`
      }

      cmd += ' -not -path "*/.*" 2>/dev/null | head -100'

      const output = await window.electronAPI.sftp.stat(searchPath)
        .then(() => true)
        .catch(() => false)

      if (!output) {
        showToast('error', `Path not found: ${searchPath}`)
        setSearching(false)
        return
      }

      // Use ssh exec via a special IPC
      const response = await window.electronAPI.ssh.exec(cmd)
      const lines = response.trim().split('\n').filter(Boolean)

      const parsed: SearchResult[] = lines.map((line) => {
        const name = line.split('/').pop() || line
        const isDirectory = !name.includes('.')
        return { path: line, name, isDirectory }
      })

      setResults(parsed)
      if (parsed.length === 0) showToast('info', 'No results found')
    } catch (err: any) {
      showToast('error', `Search failed: ${err.message}`)
    } finally {
      setSearching(false)
    }
  }, [query, searchPath, fileType, dateFilter])

  const toggleResult = useCallback((path: string) => {
    setSelectedResults((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleDownloadSelected = useCallback(async () => {
    if (selectedResults.size === 0) return
    const dest = await window.electronAPI.dialog.saveDirectory()
    if (dest.canceled || !dest.filePaths[0]) return

    let downloaded = 0
    for (const filePath of selectedResults) {
      try {
        const name = filePath.split('/').pop() || 'file'
        await window.electronAPI.sftp.download(filePath, `${dest.filePaths[0]}/${name}`)
        downloaded++
      } catch (err: any) {
        showToast('error', `Failed: ${filePath.split('/').pop()}`)
      }
    }
    if (downloaded > 0) showToast('success', `Downloaded ${downloaded} file(s)`)
  }, [selectedResults])

  return (
    <div className="h-full flex flex-col p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <svg className="w-6 h-6 text-mac-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Search Files
      </h2>

      {/* Search bar */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 bg-mac-input border border-mac-border rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-mac-accent"
          placeholder="Search by filename..."
        />
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="bg-mac-accent hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase font-semibold text-mac-muted">Path</label>
          <input
            type="text"
            value={searchPath}
            onChange={(e) => setSearchPath(e.target.value)}
            className="bg-mac-input border border-mac-border rounded-lg text-xs text-white px-2 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-mac-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase font-semibold text-mac-muted">Type</label>
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value as FileTypeFilter)}
            className="bg-mac-input border border-mac-border rounded-lg text-xs text-mac-muted px-2 py-1.5 focus:outline-none"
          >
            <option value="all">All</option>
            <option value="documents">Documents</option>
            <option value="images">Images</option>
            <option value="code">Code</option>
            <option value="media">Media</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase font-semibold text-mac-muted">Modified</label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="bg-mac-input border border-mac-border rounded-lg text-xs text-mac-muted px-2 py-1.5 focus:outline-none"
          >
            <option value="all">Any time</option>
            <option value="1">Last 24h</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto bg-mac-input border border-mac-border rounded-lg">
        {results.length > 0 ? (
          <div>
            <div className="px-3 py-2 border-b border-mac-border flex items-center justify-between">
              <span className="text-xs text-mac-muted">{results.length} result(s)</span>
              {selectedResults.size > 0 && (
                <button
                  onClick={handleDownloadSelected}
                  className="text-xs text-mac-accent hover:text-blue-400 font-medium transition-colors"
                >
                  Download selected ({selectedResults.size})
                </button>
              )}
            </div>
            {results.map((r) => (
              <div
                key={r.path}
                className={`flex items-center gap-2 px-3 py-2 hover:bg-mac-border/30 transition-colors border-b border-mac-border/30 last:border-0 ${
                  selectedResults.has(r.path) ? 'bg-mac-accent/10' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedResults.has(r.path)}
                  onChange={() => toggleResult(r.path)}
                  className="rounded border-mac-border bg-mac-input text-mac-accent focus:ring-mac-accent w-3.5 h-3.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{r.name}</div>
                  <div className="text-[10px] text-mac-muted truncate">{r.path}</div>
                </div>
              </div>
            ))}
          </div>
        ) : !searching ? (
          <div className="flex items-center justify-center h-full text-mac-muted text-sm">
            Search for files on the Mac Mini
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-mac-muted text-sm">
            Searching...
          </div>
        )}
      </div>
    </div>
  )
}
