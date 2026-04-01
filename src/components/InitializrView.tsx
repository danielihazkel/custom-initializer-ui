import { TemplatePicker } from './TemplatePicker'
import { OptionsPanel } from './OptionsPanel'
import { ProjectForm } from './ProjectForm'
import { ModuleSelector } from './ModuleSelector'
import { DependencySelector } from './DependencySelector'
import type { InitializrMetadata, ProjectFormValues, StarterTemplate, DependencyExtensions, CompatibilityRule, ModuleTemplate } from '../types'

interface InitializrViewProps {
  metadata: InitializrMetadata | null
  templates: StarterTemplate[]
  moduleTemplates: ModuleTemplate[]
  extensions: DependencyExtensions
  compatibilityRules: CompatibilityRule[]
  
  form: ProjectFormValues
  selectedDeps: string[]
  selectedOptions: Record<string, string[]>
  activeTemplate: string | null
  multiModuleEnabled: boolean
  selectedModules: string[]
  
  onFormChange: (updates: Partial<ProjectFormValues>) => void
  onDepsChange: (newSelected: string[]) => void
  onOptionsChange: (depId: string, optIds: string[]) => void
  onTemplateSelect: (template: StarterTemplate | null) => void
  onMultiModuleToggle: () => void
  onModulesChange: (modules: string[]) => void
  onCompareOpen: () => void
}

export function InitializrView({
  metadata,
  templates,
  moduleTemplates,
  extensions,
  compatibilityRules,
  form,
  selectedDeps,
  selectedOptions,
  activeTemplate,
  multiModuleEnabled,
  selectedModules,
  onFormChange,
  onDepsChange,
  onOptionsChange,
  onTemplateSelect,
  onMultiModuleToggle,
  onModulesChange,
  onCompareOpen
}: InitializrViewProps) {
  return (
    <>
      <div className="max-w-7xl mx-auto px-8 relative z-10 animate-fade-in-up">
        <TemplatePicker
          templates={templates}
          activeTemplateId={activeTemplate}
          onSelect={onTemplateSelect}
          onCompare={onCompareOpen}
        />
      </div>
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-12 gap-10 relative z-10 animate-fade-in-up">
        {/* Left Column */}
        <section className="col-span-12 lg:col-span-5 space-y-8">
          <div className="mb-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">
              Project Setup
            </h2>
            <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
              Configure metadata and core language settings
            </p>
          </div>
          <OptionsPanel metadata={metadata} values={form} onChange={onFormChange} section="upper" />
          <ProjectForm values={form} onChange={onFormChange} />
          <OptionsPanel metadata={metadata} values={form} onChange={onFormChange} section="lower" />

          {/* Multi-Module Toggle */}
          {moduleTemplates.length > 0 && (
            <div className="glass-panel rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>account_tree</span>
                    Multi-Module Project
                  </h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Generate a parent POM with sub-modules</p>
                </div>
                <button
                  role="switch"
                  aria-checked={multiModuleEnabled}
                  onClick={onMultiModuleToggle}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${multiModuleEnabled ? 'bg-primary' : 'bg-surface-container-high'}`}
                  aria-label="Toggle multi-module"
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${multiModuleEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {multiModuleEnabled && (
                <ModuleSelector
                  modules={moduleTemplates}
                  selectedModules={selectedModules}
                  onChange={onModulesChange}
                />
              )}
            </div>
          )}
        </section>

        {/* Right Column — Dependencies */}
        <section className="col-span-12 lg:col-span-7">
          <DependencySelector
            metadata={metadata}
            selected={selectedDeps}
            onChange={onDepsChange}
            extensions={extensions}
            selectedOptions={selectedOptions}
            onOptionsChange={onOptionsChange}
            compatibilityRules={compatibilityRules}
          />
        </section>
      </div>
    </>
  )
}
