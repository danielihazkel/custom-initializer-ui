import type { InitializrMetadata, ProjectFormValues } from '../types'

export function parseUrlParams(): {
  form: Partial<ProjectFormValues>
  selected: string[]
  selectedOptions: Record<string, string[]>
} | null {
  const p = new URLSearchParams(window.location.search)
  if (!p.has('groupId') && !p.has('dependencies')) return null

  const form: Partial<ProjectFormValues> = {}
  for (const key of [
    'groupId', 'artifactId', 'name', 'description', 'packageName',
    'bootVersion', 'language', 'type', 'packaging', 'javaVersion',
  ] as const) {
    const v = p.get(key)
    if (v !== null) form[key] = v
  }

  const deps = p.get('dependencies')
  const selected = deps ? deps.split(',').filter(Boolean) : []

  const selectedOptions: Record<string, string[]> = {}
  for (const [k, v] of p.entries()) {
    if (k.startsWith('opts-')) {
      selectedOptions[k.slice(5)] = v.split(',').filter(Boolean)
    }
  }

  return { form, selected, selectedOptions }
}

export function defaultForm(metadata: InitializrMetadata | null): ProjectFormValues {
  return {
    groupId: 'com.menora',
    artifactId: 'demo',
    name: 'demo',
    description: 'Demo project for Spring Boot',
    packageName: 'com.menora.demo',
    bootVersion: metadata?.bootVersion?.default ?? '',
    language: metadata?.language?.default ?? 'java',
    type: metadata?.type?.default ?? 'maven-project',
    packaging: metadata?.packaging?.default ?? 'jar',
    javaVersion: metadata?.javaVersion?.default ?? '21',
  }
}

export function triggerDownload(
  form: ProjectFormValues,
  selected: string[],
  selectedOptions: Record<string, string[]>,
  multiModule?: { enabled: boolean; modules: string[] }
): void {
  const isMultiModule = multiModule?.enabled && multiModule.modules.length > 0
  const url = new URL(isMultiModule ? '/starter-multimodule.zip' : '/starter.zip', window.location.origin)
  
  url.searchParams.set('type', form.type)
  url.searchParams.set('language', form.language)
  url.searchParams.set('bootVersion', form.bootVersion)
  url.searchParams.set('groupId', form.groupId)
  url.searchParams.set('artifactId', form.artifactId)
  url.searchParams.set('name', form.name)
  url.searchParams.set('description', form.description)
  url.searchParams.set('packageName', form.packageName)
  url.searchParams.set('packaging', form.packaging)
  url.searchParams.set('javaVersion', form.javaVersion)
  
  if (isMultiModule) {
    url.searchParams.set('modules', multiModule!.modules.join(','))
  }
  if (selected.length > 0) {
    url.searchParams.set('dependencies', selected.join(','))
  }
  for (const [depId, optIds] of Object.entries(selectedOptions)) {
    if (optIds.length > 0 && selected.includes(depId)) {
      url.searchParams.set(`opts-${depId}`, optIds.join(','))
    }
  }
  
  const a = document.createElement('a')
  a.href = url.toString()
  a.download = `${form.artifactId}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
