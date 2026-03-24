import { useState } from 'react'
import type { AdminTab } from '../../types'
import { AdminTabBar } from './AdminTabBar'
import { DependencyGroupsTab } from './dependency-groups/DependencyGroupsTab'
import { DependencyEntriesTab } from './dependency-entries/DependencyEntriesTab'
import { FileContributionsTab } from './file-contributions/FileContributionsTab'
import { BuildCustomizationsTab } from './build-customizations/BuildCustomizationsTab'
import { SubOptionsTab } from './sub-options/SubOptionsTab'

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('groups')

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-on-surface">Configuration</h1>
        <p className="text-sm text-secondary mt-0.5">
          Manage dependency catalog, file contributions, and build customizations. After making changes, click <strong>Refresh Metadata</strong> to apply them to the initializr.
        </p>
      </div>

      <AdminTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'groups'     && <DependencyGroupsTab />}
      {activeTab === 'entries'    && <DependencyEntriesTab />}
      {activeTab === 'files'      && <FileContributionsTab />}
      {activeTab === 'builds'     && <BuildCustomizationsTab />}
      {activeTab === 'suboptions' && <SubOptionsTab />}
    </div>
  )
}
