
import { useAdminResource } from '../../../hooks/useAdminResource'
import type { AdminDependencyGroup, AdminDependencyEntry, AdminStarterTemplate } from '../../../types'

export function OverviewTab() {
  const { items: groups } = useAdminResource<AdminDependencyGroup>('/admin/dependency-groups')
  const { items: entries } = useAdminResource<AdminDependencyEntry>('/admin/dependency-entries')
  const { items: templates } = useAdminResource<AdminStarterTemplate>('/admin/starter-templates')

  // Calculate totals to display
  const totalGroups = groups.length
  const totalEntries = entries.length
  const totalTemplates = templates.length

  const stats = [
    { label: 'Dependencies Catalog', value: totalEntries, icon: 'widgets', color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Dependency Groups', value: totalGroups, icon: 'folder', color: 'text-tertiary', bg: 'bg-tertiary/10' },
    { label: 'Starter Templates', value: totalTemplates, icon: 'dashboard', color: 'text-secondary', bg: 'bg-secondary/10' },
  ]

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-bold text-on-surface tracking-tight">Admin Dashboard</h2>
        <p className="text-sm text-secondary mt-1">
          Welcome to the control center. Configure metadata, dependencies, and rules for the Spring Initializr UI.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map(s => (
          <div key={s.label} className="glass-panel p-6 rounded-2xl flex items-center justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-secondary">{s.label}</p>
              <h3 className="text-3xl font-black text-on-surface">{s.value}</h3>
            </div>
            <div className={`p-4 rounded-xl ${s.bg}`}>
              <span className={`material-symbols-outlined ${s.color}`} style={{ fontSize: '32px' }}>
                {s.icon}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        {/* Quick Links / Actions */}
        <div className="glass-card p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 bg-primary/10 rounded-full">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '36px' }}>rocket_launch</span>
          </div>
          <div>
            <h4 className="font-bold text-on-surface text-lg">Platform Health Check</h4>
            <p className="text-sm text-secondary mt-1">Review compatibility rules and file contributions to ensure standard configurations are met.</p>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 bg-tertiary/10 rounded-full">
            <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '36px' }}>tune</span>
          </div>
          <div>
            <h4 className="font-bold text-on-surface text-lg">Build Customizations</h4>
            <p className="text-sm text-secondary mt-1">Apply specific repositories, build exclusions, and custom dependency behaviors.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
