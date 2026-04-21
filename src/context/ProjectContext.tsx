import React, { createContext, useContext } from 'react'
import type { InitializrMetadata, ProjectFormValues, ProjectSnapshot, StarterTemplate, SqlByDep, SqlWizardEntry, OpenApiByDep, OpenApiWizardEntry } from '../types'

export interface ProjectContextValue {
  metadata: InitializrMetadata | null
  loading: boolean
  error: string | null

  form: ProjectFormValues
  selected: string[]
  selectedOptions: Record<string, string[]>
  sqlByDep: SqlByDep
  openApiByDep: OpenApiByDep
  multiModuleEnabled: boolean
  selectedModules: string[]
  activeTemplate: string | null

  setMultiModuleEnabled: React.Dispatch<React.SetStateAction<boolean>>
  setSelectedModules: React.Dispatch<React.SetStateAction<string[]>>
  
  handleFormChange: (updates: Partial<ProjectFormValues>) => void
  handleDepsChange: (newSelected: string[]) => void
  handleOptionsChange: (depId: string, optIds: string[]) => void
  handleSqlByDepChange: (depId: string, entry: SqlWizardEntry | null) => void
  handleOpenApiByDepChange: (depId: string, entry: OpenApiWizardEntry | null) => void
  handleTemplateSelect: (template: StarterTemplate | null) => void
  
  applySnapshot: (snapshot: ProjectSnapshot) => void
  setActiveTemplate: React.Dispatch<React.SetStateAction<string | null>>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ 
  value, 
  children 
}: { 
  value: ProjectContextValue
  children: React.ReactNode 
}) {
  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext)
  if (!ctx) {
    throw new Error('useProjectContext must be used within a ProjectProvider')
  }
  return ctx
}
