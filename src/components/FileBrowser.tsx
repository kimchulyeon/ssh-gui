import { useState, useEffect, useCallback, useMemo } from 'react'
import type { RemoteFile } from '../types'
import ConfirmDialog from './ui/ConfirmDialog'
import { showToast } from './ui/Toast'
import { addHistory } from './HistoryScreen'
import { formatSize, formatDate } from '../utils/format'

interface Props {
  remoteUser: string
}

type SortKey = 'name' | 'date' | 'size'
type ViewMode = 'list' | 'grid'

interface FavoriteItem {
  label: string
  path: string
  removable: boolean
}

const DEFAULT_FAVORITES = (home: string): FavoriteItem[] => [
  { label: 'Home', path: home, removable: false },
  { label: 'Desktop', path: `${home}/Desktop`, removable: false },
  { label: 'Downloads', path: `${home}/Downloads`, removable: false },
  { label: 'Documents', path: `${home}/Documents`, removable: false },
]

export default function FileBrowser({ remoteUser }: Props) {
  const homePath = `/Users/${remoteUser}`
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => DEFAULT_FAVORITES(homePath))
  const [favContextMenu, setFavContextMenu] = useState<{ x: number; y: number; fav: FavoriteItem } | null>(null)

  // Load saved favorites
  useEffect(() => {
    window.electronAPI.settings.get('favorites').then((saved: FavoriteItem[] | undefined) => {
      if (saved && saved.length > 0) {
        setFavorites([...DEFAULT_FAVORITES(homePath), ...saved])
      }
    })
  }, [homePath])

  // Save custom favorites
  const saveFavorites = useCallback((favs: FavoriteItem[]) => {
    const custom = favs.filter((f) => f.removable)
    window.electronAPI.settings.set('favorites', custom)
  }, [])

  const addFavorite = useCallback((path: string) => {
    const label = path.split('/').pop() || path
    if (favorites.some((f) => f.path === path)) {
      showToast('info', 'Already in favorites')
      return
    }
    const newFavs = [...favorites, { label, path, removable: true }]
    setFavorites(newFavs)
    saveFavorites(newFavs)
    showToast('success', `Added "${label}" to favorites`)
  }, [favorites, saveFavorites])

  const removeFavorite = useCallback((path: string) => {
    const newFavs = favorites.filter((f) => f.path !== path)
    setFavorites(newFavs)
    saveFavorites(newFavs)
  }, [favorites, saveFavorites])

  const [currentPath, setCurrentPath] = useState(homePath)
  const [files, setFiles] = useState<RemoteFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<string[]>([homePath])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: RemoteFile } | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [pathInput, setPathInput] = useState(currentPath)
  const [editingPath, setEditingPath] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<RemoteFile[] | null>(null)

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true)
    setError('')
    setSearchResults(null)
    setSearchQuery('')
    try {
      const result = await window.electronAPI.sftp.readdir(path)
      setFiles(result)
      setCurrentPath(path)
      setPathInput(path)
      setSelectedFiles(new Set())
    } catch (err: any) {
      setError(err.message || 'Failed to load directory')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDirectory(currentPath)
  }, [])

  const navigateTo = useCallback(
    (path: string) => {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(path)
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
      loadDirectory(path)
    },
    [history, historyIndex, loadDirectory]
  )

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      loadDirectory(history[newIndex])
    }
  }, [historyIndex, history, loadDirectory])

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      loadDirectory(history[newIndex])
    }
  }, [historyIndex, history, loadDirectory])

  const goUp = useCallback(() => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/'
    navigateTo(parent)
  }, [currentPath, navigateTo])

  const handleFileClick = useCallback(
    (file: RemoteFile, e: React.MouseEvent) => {
      if (e.detail === 2) {
        // Double click
        if (file.isDirectory) {
          navigateTo(file.path)
        }
        return
      }

      // Single click - select
      if (e.metaKey) {
        setSelectedFiles((prev) => {
          const next = new Set(prev)
          if (next.has(file.path)) next.delete(file.path)
          else next.add(file.path)
          return next
        })
      } else {
        setSelectedFiles(new Set([file.path]))
      }
    },
    [navigateTo]
  )

  const handleContextMenu = useCallback((e: React.MouseEvent, file: RemoteFile) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, file })
  }, [])

  useEffect(() => {
    const close = () => { setContextMenu(null); setFavContextMenu(null) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const [deleteTarget, setDeleteTarget] = useState<RemoteFile | null>(null)

  const handleDeleteRequest = useCallback(
    (file: RemoteFile) => {
      setContextMenu(null)
      setDeleteTarget(file)
    },
    []
  )

  const handleDeleteConfirm = useCallback(
    async () => {
      if (!deleteTarget) return
      try {
        await window.electronAPI.sftp.delete(deleteTarget.path, deleteTarget.isDirectory)
        showToast('success', `Deleted "${deleteTarget.name}"`)
        loadDirectory(currentPath)
      } catch (err: any) {
        showToast('error', `Delete failed: ${err.message}`)
      } finally {
        setDeleteTarget(null)
      }
    },
    [deleteTarget, currentPath, loadDirectory]
  )

  const handleRename = useCallback(
    async (file: RemoteFile) => {
      setContextMenu(null)
      setEditingName(file.path)
      setNewName(file.name)
    },
    []
  )

  const submitRename = useCallback(
    async (file: RemoteFile) => {
      if (!newName || newName === file.name) {
        setEditingName(null)
        return
      }
      const dir = file.path.split('/').slice(0, -1).join('/')
      try {
        await window.electronAPI.sftp.rename(file.path, `${dir}/${newName}`)
        setEditingName(null)
        loadDirectory(currentPath)
      } catch (err: any) {
        setError(err.message)
      }
    },
    [newName, currentPath, loadDirectory]
  )

  const handleNewFolder = useCallback(async () => {
    const name = prompt('New folder name:')
    if (!name) return
    try {
      await window.electronAPI.sftp.mkdir(`${currentPath}/${name}`)
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(err.message)
    }
  }, [currentPath, loadDirectory])

  const handleDownload = useCallback(
    async (file: RemoteFile) => {
      setContextMenu(null)
      const result = await window.electronAPI.dialog.saveDirectory()
      if (result.canceled || !result.filePaths[0]) return
      try {
        const localPath = `${result.filePaths[0]}/${file.name}`
        await window.electronAPI.sftp.download(file.path, localPath)
        showToast('success', `Downloaded "${file.name}"`)
        addHistory({ filename: file.name, direction: 'download', success: true })
      } catch (err: any) {
        showToast('error', `Download failed: ${err.message}`)
        addHistory({ filename: file.name, direction: 'download', success: false, error: err.message })
      }
    },
    []
  )

  const handlePathSubmit = useCallback(() => {
    setEditingPath(false)
    if (pathInput !== currentPath) {
      navigateTo(pathInput)
    }
  }, [pathInput, currentPath, navigateTo])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    setError('')
    try {
      const cmd = `find ${currentPath} -maxdepth 5 -iname "*${searchQuery.trim()}*" -not -path "*/.*" 2>/dev/null | head -50`
      const output = await window.electronAPI.ssh.exec(cmd)
      const lines = output.trim().split('\n').filter(Boolean)
      const results: RemoteFile[] = lines.map((line) => {
        const name = line.split('/').pop() || line
        return {
          name,
          path: line,
          // Search results don't carry type info; default to file.
          // Clicking a directory result will navigate into it via readdir.
          isDirectory: false,
          size: 0,
          modifiedAt: '',
          permissions: '',
        }
      })
      setSearchResults(results)
      if (results.length === 0) showToast('info', 'No results found')
    } catch (err: any) {
      showToast('error', `Search failed: ${err.message}`)
    } finally {
      setSearching(false)
    }
  }, [searchQuery, currentPath])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults(null)
  }, [])

  const sortedFiles = useMemo(() => [...files].sort((a, b) => {
    // Directories always first
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    switch (sortKey) {
      case 'date':
        return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      case 'size':
        return b.size - a.size
      default:
        return a.name.localeCompare(b.name)
    }
  }), [files, sortKey])

  const displayFiles = searchResults ?? sortedFiles

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <aside className="w-48 border-r border-mac-border p-3 flex flex-col gap-1 shrink-0">
        <div className="text-[10px] uppercase font-semibold text-mac-muted mb-2 ml-2">
          Favorites
        </div>
        {favorites.map((fav) => (
          <button
            key={fav.path}
            onClick={() => navigateTo(fav.path)}
            onContextMenu={(e) => {
              if (!fav.removable) return
              e.preventDefault()
              setFavContextMenu({ x: e.clientX, y: e.clientY, fav })
            }}
            className={`text-left text-sm px-2 py-1.5 rounded-lg transition-colors flex items-center gap-2 group ${
              currentPath === fav.path
                ? 'bg-mac-accent/20 text-mac-accent'
                : 'text-mac-muted hover:text-white hover:bg-mac-border/50'
            }`}
          >
            <svg className="w-4 h-4 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="truncate">{fav.label}</span>
          </button>
        ))}

        <div className="mt-3 pt-3 border-t border-mac-border space-y-1">
          <button
            onClick={() => addFavorite(currentPath)}
            className="text-sm text-mac-muted hover:text-white px-2 py-1.5 rounded-lg hover:bg-mac-border/50 transition-colors w-full text-left flex items-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            Add to Favorites
          </button>
          <button
            onClick={handleNewFolder}
            className="text-sm text-mac-muted hover:text-white px-2 py-1.5 rounded-lg hover:bg-mac-border/50 transition-colors w-full text-left flex items-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Folder
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Search bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-mac-border">
          <svg className="w-4 h-4 text-mac-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 bg-transparent text-sm text-white placeholder-mac-muted focus:outline-none"
            placeholder={`Search in ${currentPath.split('/').pop() || '/'}...`}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="text-mac-muted hover:text-white text-xs transition-colors"
            >
              Clear
            </button>
          )}
          {searching && <span className="text-[10px] text-mac-muted">Searching...</span>}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-mac-border">
          {/* Navigation */}
          <button
            onClick={goBack}
            disabled={historyIndex === 0}
            className="text-mac-muted hover:text-white disabled:opacity-30 transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="text-mac-muted hover:text-white disabled:opacity-30 transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={goUp}
            className="text-mac-muted hover:text-white transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>

          {/* Path bar */}
          <div className="flex-1 mx-2">
            {editingPath ? (
              <input
                type="text"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onBlur={handlePathSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handlePathSubmit()}
                className="w-full bg-mac-input border border-mac-border rounded-lg text-xs text-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-mac-accent"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setEditingPath(true)}
                className="w-full text-left bg-mac-input border border-mac-border rounded-lg text-xs text-mac-muted px-3 py-1.5 hover:text-white transition-colors truncate"
              >
                {currentPath}
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-mac-input border border-mac-border rounded-lg text-xs text-mac-muted px-2 py-1.5 focus:outline-none"
          >
            <option value="name">Name</option>
            <option value="date">Date</option>
            <option value="size">Size</option>
          </select>

          {/* View toggle */}
          <div className="flex bg-mac-input border border-mac-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 py-1.5 text-xs ${viewMode === 'list' ? 'bg-mac-border text-white' : 'text-mac-muted'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2 py-1.5 text-xs ${viewMode === 'grid' ? 'bg-mac-border text-white' : 'text-mac-muted'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-2 text-xs text-mac-danger bg-mac-danger/10 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center h-full text-mac-muted text-sm">
              Loading...
            </div>
          ) : viewMode === 'list' ? (
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase text-mac-muted border-b border-mac-border">
                  <th className="text-left py-2 px-3 font-semibold">Name</th>
                  <th className="text-left py-2 px-3 font-semibold w-28">Date Modified</th>
                  <th className="text-right py-2 px-3 font-semibold w-20">Size</th>
                </tr>
              </thead>
              <tbody>
                {displayFiles.map((file) => (
                  <tr
                    key={file.path}
                    onClick={(e) => handleFileClick(file, e)}
                    onContextMenu={(e) => handleContextMenu(e, file)}
                    className={`text-sm cursor-default transition-colors ${
                      selectedFiles.has(file.path)
                        ? 'bg-mac-accent/20'
                        : 'hover:bg-mac-border/30'
                    }`}
                  >
                    <td className="py-1.5 px-3 flex items-center gap-2">
                      <span className="text-mac-muted text-xs">
                        {file.isDirectory ? (
                          <svg className="w-4 h-4 text-mac-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </span>
                      {editingName === file.path ? (
                        <input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onBlur={() => submitRename(file)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename(file)
                            if (e.key === 'Escape') setEditingName(null)
                          }}
                          className="bg-mac-input border border-mac-accent rounded px-1 py-0.5 text-sm text-white focus:outline-none w-60"
                          autoFocus
                        />
                      ) : (
                        <span>{file.name}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-mac-muted text-xs">{formatDate(file.modifiedAt)}</td>
                    <td className="py-1.5 px-3 text-mac-muted text-xs text-right">
                      {file.isDirectory ? '-' : formatSize(file.size)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-5 gap-2 p-2">
              {displayFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={(e) => handleFileClick(file, e)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${
                    selectedFiles.has(file.path) ? 'bg-mac-accent/20' : 'hover:bg-mac-border/30'
                  }`}
                >
                  {file.isDirectory ? (
                    <svg className="w-10 h-10 text-mac-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-10 h-10 text-mac-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  <span className="text-xs text-center truncate w-full">{file.name}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && files.length === 0 && (
            <div className="flex items-center justify-center h-full text-mac-muted text-sm">
              Empty folder
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="border-t border-mac-border px-4 py-1.5 flex items-center justify-between text-[11px] text-mac-muted">
          <span>{searchResults ? `${searchResults.length} result(s)` : `${files.length} items`}</span>
          <span>{selectedFiles.size > 0 ? `${selectedFiles.size} selected` : currentPath}</span>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu fixed bg-mac-card border border-mac-border rounded-lg shadow-2xl py-1 min-w-[160px] z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleDownload(contextMenu.file)}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-mac-accent/20 transition-colors"
          >
            Download
          </button>
          <button
            onClick={() => handleRename(contextMenu.file)}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-mac-accent/20 transition-colors"
          >
            Rename
          </button>
          {contextMenu.file.isDirectory && (
            <>
              <button
                onClick={() => {
                  setContextMenu(null)
                  navigateTo(contextMenu.file.path)
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-mac-accent/20 transition-colors"
              >
                Open
              </button>
              <button
                onClick={() => {
                  addFavorite(contextMenu.file.path)
                  setContextMenu(null)
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-mac-accent/20 transition-colors"
              >
                Add to Favorites
              </button>
            </>
          )}
          <div className="border-t border-mac-border my-1" />
          <button
            onClick={() => handleDeleteRequest(contextMenu.file)}
            className="w-full text-left px-3 py-1.5 text-sm text-mac-danger hover:bg-mac-danger/10 transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      {/* Favorite Context Menu */}
      {favContextMenu && (
        <div
          className="context-menu fixed bg-mac-card border border-mac-border rounded-lg shadow-2xl py-1 min-w-[140px] z-50"
          style={{ left: favContextMenu.x, top: favContextMenu.y }}
        >
          <button
            onClick={() => {
              removeFavorite(favContextMenu.fav.path)
              setFavContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-mac-danger hover:bg-mac-danger/10 transition-colors"
          >
            Remove from Favorites
          </button>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete"
          message={`Are you sure you want to delete "${deleteTarget.name}"?${deleteTarget.isDirectory ? ' This will delete all contents inside.' : ''}`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
