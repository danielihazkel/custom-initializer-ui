import { useState, useRef } from 'react'
import type { AdminTab, Toast } from '../../types'
import { StatusToast } from './shared/StatusToast'
import { ImportConfirmDialog } from './shared/ImportConfirmDialog'
import { getAuthHeaders } from '../../hooks/useAdminResource'

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'groups',     label: 'Dep Groups',    icon: 'folder' },
  { id: 'entries',    label: 'Dependencies',  icon: 'widgets' },
  { id: 'files',      label: 'File Contribs', icon: 'description' },
  { id: 'builds',     label: 'Build Custom.', icon: 'build' },
  { id: 'suboptions',    label: 'Sub-Options',   icon: 'tune' },
  { id: 'compatibility', label: 'Compatibility', icon: 'compare_arrows' },
  { id: 'templates',     label: 'Templates',     icon: 'dashboard' },
  { id: 'modules',       label: 'Modules',       icon: 'account_tree' },
]

interface AdminTabBarProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
  onImportComplete?: () => void
}

export function AdminTabBar({ activeTab, onTabChange, onImportComplete }: AdminTabBarProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [importFile, setImportFile] = useState<{ name: string; content: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/admin/refresh', { method: 'POST', headers: getAuthHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setToast({ message: 'Metadata cache refreshed', type: 'success' })
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setRefreshing(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/admin/export', { headers: { Accept: 'application/json', ...getAuthHeaders() } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `initializr-config-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setToast({ message: 'Configuration exported', type: 'success' })
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setExporting(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImportFile({ name: file.name, content: reader.result as string })
    }
    reader.readAsText(file)
    // Reset so the same file can be selected again
    e.target.value = ''
  }

  async function handleImportConfirm() {
    if (!importFile) return
    setImporting(true)
    try {
      const res = await fetch('/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: importFile.content,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const detail = body?.detail || body?.error || `HTTP ${res.status}`
        throw new Error(detail)
      }
      const result = await res.json()
      const counts = result.imported as Record<string, number>
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      setToast({ message: `Imported ${total} records successfully`, type: 'success' })
      setImportFile(null)
      onImportComplete?.()
    } catch (err) {
      setToast({ message: `Import failed: ${(err as Error).message}`, type: 'error' })
    } finally {
      setImporting(false)
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
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <button
            onClick={handleExport}
            disabled={exporting}
            title="Export all configuration as JSON"
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium border border-outline-variant text-secondary hover:text-on-surface transition-all disabled:opacity-60"
          >
            <span className={`material-symbols-outlined ${exporting ? 'animate-spin' : ''}`} style={{ fontSize: '16px' }}>
              download
            </span>
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import configuration from JSON file (replaces all data)"
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium border border-outline-variant text-secondary hover:text-on-surface transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload</span>
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Reload the dependency metadata cache so the initializr UI picks up DB changes"
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium border border-outline-variant text-secondary hover:text-on-surface transition-all disabled:opacity-60"
          >
            <span
              className={`material-symbols-outlined ${refreshing ? 'animate-spin' : ''}`}
              style={{ fontSize: '16px' }}
            >
              refresh
            </span>
            Refresh
          </button>
        </div>
      </div>

      {importFile && (
        <ImportConfirmDialog
          fileName={importFile.name}
          onConfirm={handleImportConfirm}
          onCancel={() => setImportFile(null)}
          importing={importing}
        />
      )}

      <StatusToast toast={toast} onClear={() => setToast(null)} />
    </>
  )
}
