import { useState, useEffect, lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AdminTab } from '../../types'
import { AdminLogin } from './AdminLogin'
import { ADMIN_UNAUTHORIZED_EVENT } from '../../hooks/useAdminResource'
import { AdminSidebar } from './AdminSidebar'
import { AdminGlobalActions } from './AdminGlobalActions'
import { AdminKindProvider, useAdminKind } from './AdminKindContext'

// Each tab is its own chunk, so the login form doesn't wait for every CRUD tab — nor for the
// code editor and the layout editor some of them carry. They are fetched in the background
// once the admin shell is up (see prefetchTabs), so switching tabs stays instant.
const TAB_LOADERS: Record<AdminTab, () => Promise<{ default: ComponentType }>> = {
  'overview': () => import('./overview/OverviewTab').then(m => ({ default: m.OverviewTab })),
  'activity': () => import('./activity/ActivityTab').then(m => ({ default: m.ActivityTab })),
  'groups': () => import('./dependency-groups/DependencyGroupsTab').then(m => ({ default: m.DependencyGroupsTab })),
  'entries': () => import('./dependency-entries/DependencyEntriesTab').then(m => ({ default: m.DependencyEntriesTab })),
  'files': () => import('./file-contributions/FileContributionsTab').then(m => ({ default: m.FileContributionsTab })),
  'builds': () => import('./build-customizations/BuildCustomizationsTab').then(m => ({ default: m.BuildCustomizationsTab })),
  'suboptions': () => import('./sub-options/SubOptionsTab').then(m => ({ default: m.SubOptionsTab })),
  'compatibility': () => import('./compatibility/CompatibilityTab').then(m => ({ default: m.CompatibilityTab })),
  'templates': () => import('./starter-templates/StarterTemplatesTab').then(m => ({ default: m.StarterTemplatesTab })),
  'modules': () => import('./module-templates/ModuleTemplatesTab').then(m => ({ default: m.ModuleTemplatesTab })),
  'palettes': () => import('./color-palettes/ColorPalettesTab').then(m => ({ default: m.ColorPalettesTab })),
  'entity-templates': () => import('./entity-templates/EntityTemplatesTab').then(m => ({ default: m.EntityTemplatesTab })),
  'fullstack-examples': () => import('./fullstack-examples/FullstackExamplesTab').then(m => ({ default: m.FullstackExamplesTab })),
  'versions': () => import('./versions/VersionsTab').then(m => ({ default: m.VersionsTab })),
  'departments': () => import('./departments/DepartmentsTab').then(m => ({ default: m.DepartmentsTab })),
}

const TABS = Object.fromEntries(
  Object.entries(TAB_LOADERS).map(([id, load]) => [id, lazy(load)]),
) as Record<AdminTab, LazyExoticComponent<ComponentType>>

/** Loads every tab's chunk (and with it the code and layout editors) while the browser is idle. */
function prefetchTabs() {
  const load = () => {
    for (const loader of Object.values(TAB_LOADERS)) loader().catch(() => {})
    import('./file-contributions/CodeEditor').catch(() => {})
    import('../fullstack/PagesEditor').catch(() => {})
  }
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(load, { timeout: 3000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = setTimeout(load, 500)
  return () => clearTimeout(id)
}

/** What a tab shows while its chunk arrives — the same spinner the tables show while loading. */
function TabFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-secondary">
      <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: '28px' }}>
        progress_activity
      </span>
      <span className="text-xs font-medium uppercase tracking-widest text-primary/80">Loading</span>
    </div>
  )
}

export function AdminPage() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('adminToken'))
  const [expired, setExpired] = useState(false)

  // A 401 on any admin request (typically a token the backend forgot after a restart) drops
  // back to the login form *here*, on the Config view, instead of reloading the whole page.
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null)
      setExpired(true)
    }
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  function handleLogin(newToken: string) {
    sessionStorage.setItem('adminToken', newToken)
    setToken(newToken)
    setExpired(false)
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
    setExpired(false)
  }

  if (!token) {
    return (
      <AdminLogin
        onSuccess={handleLogin}
        notice={expired ? 'Your session has expired. Please sign in again.' : undefined}
      />
    )
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
  const ActiveTab = TABS[activeTab]

  useEffect(prefetchTabs, [])

  useEffect(() => {
    if (activeTab === 'modules' && kind === 'FRONTEND') setActiveTab('overview')
    if (activeTab === 'palettes' && kind === 'BACKEND') setActiveTab('overview')
    if (activeTab === 'entity-templates' && kind === 'FRONTEND') setActiveTab('overview')
    if (activeTab === 'fullstack-examples' && kind === 'FRONTEND') setActiveTab('overview')
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
              <Suspense fallback={<TabFallback />}>
                <ActiveTab />
              </Suspense>
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
