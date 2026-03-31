import type { AdminTab } from '../../types'

const TABS: { id: AdminTab; label: string; icon: string; desc: string }[] = [
  { id: 'groups',     label: 'Dep Groups',    icon: 'folder',         desc: 'Categories for UI' },
  { id: 'entries',    label: 'Dependencies',  icon: 'widgets',        desc: 'Main catalog' },
  { id: 'files',      label: 'File Contribs', icon: 'description',    desc: 'Custom project files' },
  { id: 'builds',     label: 'Build Custom.', icon: 'build',          desc: 'POM & Gradle edits' },
  { id: 'suboptions',    label: 'Sub-Options',   icon: 'tune',           desc: 'Configurable options' },
  { id: 'compatibility', label: 'Compatibility', icon: 'compare_arrows', desc: 'Version rules' },
  { id: 'templates',     label: 'Templates',     icon: 'dashboard',      desc: 'Starter bundles' },
  { id: 'modules',       label: 'Modules',       icon: 'account_tree',   desc: 'Multi-module setup' },
]

interface AdminSidebarProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  return (
    <aside className="w-64 border-r border-outline-variant bg-surface-container-low flex flex-col h-full shrink-0">
      <div className="p-6 border-b border-outline-variant bg-surface/50 backdrop-blur-sm">
        <h2 className="font-bold text-on-surface tracking-wide uppercase text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>settings</span>
          Admin Panel
        </h2>
        <p className="text-[11px] text-secondary mt-1">Manage platform configuration</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group ${
              activeTab === tab.id
                ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                : 'text-secondary hover:bg-surface-container-high hover:text-on-surface border border-transparent'
            }`}
          >
            <span 
              className={`material-symbols-outlined transition-colors duration-200 ${
                activeTab === tab.id ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'
              }`} 
              style={{ fontSize: '20px' }}
            >
              {tab.icon}
            </span>
            <div className="flex flex-col">
              <span className={`text-sm font-bold ${activeTab === tab.id ? 'text-primary' : 'text-on-surface'}`}>
                {tab.label}
              </span>
              <span className={`text-[10px] ${activeTab === tab.id ? 'text-primary/70' : 'text-on-surface-variant'}`}>
                {tab.desc}
              </span>
            </div>
          </button>
        ))}
      </nav>
    </aside>
  )
}
