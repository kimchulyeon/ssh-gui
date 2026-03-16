import type { Screen, ConnectionProfile } from '../types'

interface Props {
  onNavigate: (screen: Screen) => void
  activeProfile?: ConnectionProfile | null
}

const menuItems = [
  {
    id: 'send' as Screen,
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    label: 'Send Files',
    desc: 'Upload files to Mac Mini',
    enabled: true,
  },
  {
    id: 'receive' as Screen,
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    label: 'Receive Files',
    desc: 'Download files from Mac Mini',
    enabled: true,
  },
  {
    id: 'browser' as Screen,
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    label: 'File Browser',
    desc: 'Browse Mac Mini files',
    enabled: true,
  },
  {
    id: 'status' as Screen,
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    label: 'Status',
    desc: 'System status & disk usage',
    enabled: true,
  },
]

export default function HomeScreen({ onNavigate, activeProfile }: Props) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 gap-4">
      {activeProfile && (
        <div className="text-sm text-mac-muted">
          Connected to <span className="text-white font-medium">{activeProfile.name}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 max-w-md w-full">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={() => item.enabled && onNavigate(item.id)}
            disabled={!item.enabled}
            className={`mac-card bg-mac-card rounded-mac p-6 flex flex-col items-center gap-3 transition-all ${
              item.enabled
                ? 'hover:bg-[#2a2a2a] hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <div className={`${item.enabled ? 'text-mac-accent' : 'text-mac-muted'}`}>
              {item.icon}
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="text-[11px] text-mac-muted mt-0.5">{item.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
