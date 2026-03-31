import { useState } from 'react'
import type { AdminTab } from '../../types'
import { AdminLogin } from './AdminLogin'
import { AdminSidebar } from './AdminSidebar'
import { AdminGlobalActions } from './AdminGlobalActions'

import { OverviewTab } from './overview/OverviewTab'
import { DependencyGroupsTab } from './dependency-groups/DependencyGroupsTab'
import { DependencyEntriesTab } from './dependency-entries/DependencyEntriesTab'
import { FileContributionsTab } from './file-contributions/FileContributionsTab'
import { BuildCustomizationsTab } from './build-customizations/BuildCustomizationsTab'
import { SubOptionsTab } from './sub-options/SubOptionsTab'
import { CompatibilityTab } from './compatibility/CompatibilityTab'
import { StarterTemplatesTab } from './starter-templates/StarterTemplatesTab'
import { ModuleTemplatesTab } from './module-templates/ModuleTemplatesTab'

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('adminToken'))
  const [reloadKey, setReloadKey] = useState(0)

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
    <div className="flex bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant shadow-lg relative z-20 mx-auto w-full max-w-[1400px]" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Sidebar Navigation */}
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Header - Top Right Corner Global Actions */}
        <header className="flex items-center justify-end px-8 py-4 border-b border-outline-variant bg-surface/80 backdrop-blur-md">
          <AdminGlobalActions 
            onImportComplete={() => setReloadKey(k => k + 1)} 
            onLogout={handleLogout} 
          />
        </header>

        {/* Tab Content */}
        <main className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
          {activeTab === 'overview'   && <OverviewTab key={`overview-${reloadKey}`} />}
          {activeTab === 'groups'     && <DependencyGroupsTab key={`groups-${reloadKey}`} />}
          {activeTab === 'entries'    && <DependencyEntriesTab key={`entries-${reloadKey}`} />}
          {activeTab === 'files'      && <FileContributionsTab key={`files-${reloadKey}`} />}
          {activeTab === 'builds'     && <BuildCustomizationsTab key={`builds-${reloadKey}`} />}
          {activeTab === 'suboptions' && <SubOptionsTab key={`suboptions-${reloadKey}`} />}
          {activeTab === 'compatibility' && <CompatibilityTab key={`compat-${reloadKey}`} />}
          {activeTab === 'templates'  && <StarterTemplatesTab key={`templates-${reloadKey}`} />}
          {activeTab === 'modules'    && <ModuleTemplatesTab key={`modules-${reloadKey}`} />}
        </main>
      </div>
    </div>
  )
}
