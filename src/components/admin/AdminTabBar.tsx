import { useState } from 'react'
import type { AdminTab, Toast } from '../../types'
import { StatusToast } from './shared/StatusToast'

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'groups',     label: 'Dep Groups',    icon: 'folder' },
  { id: 'entries',    label: 'Dependencies',  icon: 'widgets' },
  { id: 'files',      label: 'File Contribs', icon: 'description' },
  { id: 'builds',     label: 'Build Custom.', icon: 'build' },
  { id: 'suboptions',    label: 'Sub-Options',   icon: 'tune' },
  { id: 'compatibility', label: 'Compatibility', icon: 'compare_arrows' },
]

interface AdminTabBarProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

export function AdminTabBar({ activeTab, onTabChange }: AdminTabBarProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/admin/refresh', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setToast({ message: 'Metadata cache refreshed', type: 'success' })
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-outline-variant mb-6">
        <div className="flex items-center gap-0 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-primary font-semibold border-primary'
                  : 'text-secondary hover:text-on-surface border-transparent'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Reload the dependency metadata cache so the initializr UI picks up DB changes"
          className="flex items-center gap-1.5 px-4 py-2 ml-4 rounded text-sm font-medium border border-outline-variant text-secondary hover:text-on-surface transition-all disabled:opacity-60 flex-shrink-0"
        >
          <span
            className={`material-symbols-outlined ${refreshing ? 'animate-spin' : ''}`}
            style={{ fontSize: '16px' }}
          >
            refresh
          </span>
          {refreshing ? 'Refreshing…' : 'Refresh Metadata'}
        </button>
      </div>

      <StatusToast toast={toast} onClear={() => setToast(null)} />
    </>
  )
}
