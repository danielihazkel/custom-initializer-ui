import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AdminTab } from '../../types'
import { AdminLogin } from './AdminLogin'
import { AdminSidebar } from './AdminSidebar'
import { AdminGlobalActions } from './AdminGlobalActions'
import { AdminKindProvider, useAdminKind } from './AdminKindContext'

import { OverviewTab } from './overview/OverviewTab'
import { ActivityTab } from './activity/ActivityTab'
import { DependencyGroupsTab } from './dependency-groups/DependencyGroupsTab'
import { DependencyEntriesTab } from './dependency-entries/DependencyEntriesTab'
import { FileContributionsTab } from './file-contributions/FileContributionsTab'
import { BuildCustomizationsTab } from './build-customizations/BuildCustomizationsTab'
import { SubOptionsTab } from './sub-options/SubOptionsTab'
import { CompatibilityTab } from './compatibility/CompatibilityTab'
import { StarterTemplatesTab } from './starter-templates/StarterTemplatesTab'
import { ModuleTemplatesTab } from './module-templates/ModuleTemplatesTab'
import { ColorPalettesTab } from './color-palettes/ColorPalettesTab'
import { EntityTemplatesTab } from './entity-templates/EntityTemplatesTab'

export function AdminPage() {
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
    <AdminKindProvider>
      <AdminPageInner onLogout={handleLogout} />
    </AdminKindProvider>
  )
}

function AdminPageInner({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [reloadKey, setReloadKey] = useState(0)
  const { kind } = useAdminKind()

  useEffect(() => {
    if (activeTab === 'modules' && kind === 'FRONTEND') setActiveTab('overview')
    if (activeTab === 'palettes' && kind === 'BACKEND') setActiveTab('overview')
    if (activeTab === 'entity-templates' && kind === 'FRONTEND') setActiveTab('overview')
  }, [activeTab, kind])

  return (
    <div className="flex bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant shadow-lg relative z-20 mx-auto w-full max-w-[1400px]" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Sidebar Navigation */}
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Header - Project-kind pill + Global Actions */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-outline-variant bg-surface/80 backdrop-blur-md">
          <ProjectKindPill />
          <AdminGlobalActions
            onImportComplete={() => setReloadKey(k => k + 1)}
            onLogout={onLogout}
          />
        </header>

        {/* Tab Content */}
        <main className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${reloadKey}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview'   && <OverviewTab />}
              {activeTab === 'activity'   && <ActivityTab />}
              {activeTab === 'groups'     && <DependencyGroupsTab />}
              {activeTab === 'entries'    && <DependencyEntriesTab />}
              {activeTab === 'files'      && <FileContributionsTab />}
              {activeTab === 'builds'     && <BuildCustomizationsTab />}
              {activeTab === 'suboptions' && <SubOptionsTab />}
              {activeTab === 'compatibility' && <CompatibilityTab />}
              {activeTab === 'templates'  && <StarterTemplatesTab />}
              {activeTab === 'modules'    && <ModuleTemplatesTab />}
              {activeTab === 'palettes'   && <ColorPalettesTab />}
              {activeTab === 'entity-templates' && <EntityTemplatesTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

function ProjectKindPill() {
  const { kind, setKind } = useAdminKind()
  const tabs: { id: 'BACKEND' | 'FRONTEND'; label: string }[] = [
    { id: 'BACKEND', label: 'Backend' },
    { id: 'FRONTEND', label: 'Frontend' },
  ]
  return (
    <div className="inline-flex p-0.5 rounded-xl border border-outline-variant bg-surface-container-high">
      {tabs.map(t => {
        const active = t.id === kind
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setKind(t.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              active ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:text-on-surface'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
