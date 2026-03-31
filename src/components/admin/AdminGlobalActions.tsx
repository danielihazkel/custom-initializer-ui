import { useState, useRef } from 'react'
import type { Toast } from '../../types'
import { StatusToast } from './shared/StatusToast'
import { ImportConfirmDialog } from './shared/ImportConfirmDialog'
import { getAuthHeaders } from '../../hooks/useAdminResource'

interface AdminGlobalActionsProps {
  onImportComplete?: () => void
  onLogout: () => void
}

export function AdminGlobalActions({ onImportComplete, onLogout }: AdminGlobalActionsProps) {
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
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={exporting}
        title="Export all configuration as JSON"
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-outline-variant bg-surface hover:bg-surface-container-high transition-all disabled:opacity-60 shadow-sm hover:shadow"
      >
        <span className={`material-symbols-outlined text-secondary ${exporting ? 'animate-spin' : ''}`} style={{ fontSize: '18px' }}>
          download
        </span>
        Export
      </button>

      <button
        onClick={() => fileInputRef.current?.click()}
        title="Import configuration from JSON file"
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-outline-variant bg-surface hover:bg-surface-container-high transition-all shadow-sm hover:shadow"
      >
        <span className="material-symbols-outlined text-secondary" style={{ fontSize: '18px' }}>upload</span>
        Import
      </button>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />

      <button
        onClick={handleRefresh}
        disabled={refreshing}
        title="Reload the dependency metadata cache"
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary transition-all disabled:opacity-60 shadow-sm"
      >
        <span className={`material-symbols-outlined ${refreshing ? 'animate-spin' : ''}`} style={{ fontSize: '18px' }}>
          refresh
        </span>
        Refresh Data
      </button>

      <div className="w-px h-6 bg-outline-variant mx-1" />

      <button
        onClick={onLogout}
        title="Lock admin panel"
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-outline-variant bg-surface text-secondary hover:text-error hover:border-error/50 hover:bg-error/10 transition-all shadow-sm"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
        Lock
      </button>

      {importFile && (
        <ImportConfirmDialog
          fileName={importFile.name}
          onConfirm={handleImportConfirm}
          onCancel={() => setImportFile(null)}
          importing={importing}
        />
      )}

      <StatusToast toast={toast} onClear={() => setToast(null)} />
    </div>
  )
}
