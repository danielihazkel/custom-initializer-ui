import { useState } from 'react'
import type { AdminTab } from '../../types'
import { AdminTabBar } from './AdminTabBar'
import { AdminLogin } from './AdminLogin'
import { DependencyGroupsTab } from './dependency-groups/DependencyGroupsTab'
import { DependencyEntriesTab } from './dependency-entries/DependencyEntriesTab'
import { FileContributionsTab } from './file-contributions/FileContributionsTab'
import { BuildCustomizationsTab } from './build-customizations/BuildCustomizationsTab'
import { SubOptionsTab } from './sub-options/SubOptionsTab'
import { CompatibilityTab } from './compatibility/CompatibilityTab'
import { StarterTemplatesTab } from './starter-templates/StarterTemplatesTab'

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('groups')
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('adminToken'))

  function handleLogin(newToken: string) {
    sessionStorage.setItem('adminToken', newToken)
    setToken(newToken)
  }

  function handleLogout() {
    const t = sessionStorage.getItem('adminToken')
    if (t) {
      fetch('/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${t}` },
      }).catch(() => {})
    }
    sessionStorage.removeItem('adminToken')
    setToken(null)
  }

  if (!token) {
    return <AdminLogin onSuccess={handleLogin} />
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-on-surface">Configuration</h1>
          <p className="text-sm text-secondary mt-0.5">
            Manage dependency catalog, file contributions, and build customizations. After making changes, click <strong>Refresh Metadata</strong> to apply them to the initializr.
          </p>
        </div>
        <button
          onClick={handleLogout}
          title="Lock admin panel"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-secondary hover:text-on-surface border border-outline-variant transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock</span>
          Lock
        </button>
      </div>

      <AdminTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'groups'     && <DependencyGroupsTab />}
      {activeTab === 'entries'    && <DependencyEntriesTab />}
      {activeTab === 'files'      && <FileContributionsTab />}
      {activeTab === 'builds'     && <BuildCustomizationsTab />}
      {activeTab === 'suboptions'    && <SubOptionsTab />}
      {activeTab === 'compatibility' && <CompatibilityTab />}
      {activeTab === 'templates'     && <StarterTemplatesTab />}
    </div>
  )
}
