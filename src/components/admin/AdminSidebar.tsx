import { useState } from 'react'
import { motion } from 'framer-motion'
import type { AdminTab } from '../../types'

const TABS: { id: AdminTab; label: string; icon: string; desc: string }[] = [
  { id: 'overview',   label: 'Overview',      icon: 'dashboard',      desc: 'Platform Dashboard' },
  { id: 'groups',     label: 'Dep Groups',    icon: 'folder',         desc: 'Categories for UI' },
  { id: 'entries',    label: 'Dependencies',  icon: 'widgets',        desc: 'Main catalog' },
  { id: 'files',      label: 'File Contribs', icon: 'description',    desc: 'Custom project files' },
  { id: 'builds',     label: 'Build Custom.', icon: 'build',          desc: 'POM & Gradle edits' },
  { id: 'suboptions', label: 'Sub-Options',   icon: 'tune',           desc: 'Configurable options' },
  { id: 'compatibility', label: 'Compatibility', icon: 'compare_arrows', desc: 'Version rules' },
  { id: 'templates',     label: 'Templates',     icon: 'view_cozy',      desc: 'Starter bundles' },
  { id: 'modules',       label: 'Modules',       icon: 'account_tree',   desc: 'Multi-module setup' },
]

interface AdminSidebarProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <aside className={`border-r border-outline-variant bg-surface-container-low flex flex-col h-full shrink-0 transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`p-6 border-b border-outline-variant bg-surface/50 backdrop-blur-sm flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <h2 className="font-bold text-on-surface tracking-wide uppercase text-sm flex items-center gap-2 whitespace-nowrap">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>settings</span>
              Admin Panel
            </h2>
            <p className="text-[11px] text-secondary mt-1 whitespace-nowrap">Manage platform config</p>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            {isCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={isCollapsed ? tab.label : undefined}
            className={`relative w-full flex items-center px-4 py-3 rounded-xl text-left transition-colors duration-200 group ${
              isCollapsed ? 'justify-center' : 'gap-3'
            } ${
              activeTab === tab.id
                ? 'text-primary'
                : 'text-secondary hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeAdminTab"
                className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl shadow-sm"
                initial={false}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span 
              className={`relative z-10 material-symbols-outlined transition-colors duration-200 shrink-0 ${
                activeTab === tab.id ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'
              }`} 
              style={{ fontSize: '20px' }}
            >
              {tab.icon}
            </span>
            {!isCollapsed && (
              <div className="relative z-10 flex flex-col whitespace-nowrap overflow-hidden">
                <span className={`text-sm font-bold truncate transition-colors duration-200 ${activeTab === tab.id ? 'text-primary' : 'text-on-surface'}`}>
                  {tab.label}
                </span>
                <span className={`text-[10px] truncate transition-colors duration-200 ${activeTab === tab.id ? 'text-primary/70' : 'text-on-surface-variant'}`}>
                  {tab.desc}
                </span>
              </div>
            )}
          </button>
        ))}
      </nav>
    </aside>
  )
}
