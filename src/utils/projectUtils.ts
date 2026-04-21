import type { InitializrMetadata, ProjectFormValues, ProjectSnapshot, SqlByDep, OpenApiByDep } from '../types'

export function captureSnapshot(args: {
  form: ProjectFormValues
  selected: string[]
  selectedOptions: Record<string, string[]>
  sqlByDep: SqlByDep
  openApiByDep: OpenApiByDep
  multiModuleEnabled: boolean
  selectedModules: string[]
}): ProjectSnapshot {
  return {
    form: { ...args.form },
    selected: [...args.selected],
    selectedOptions: JSON.parse(JSON.stringify(args.selectedOptions)),
    sqlByDep: JSON.parse(JSON.stringify(args.sqlByDep)),
    openApiByDep: JSON.parse(JSON.stringify(args.openApiByDep)),
    multiModuleEnabled: args.multiModuleEnabled,
    selectedModules: [...args.selectedModules],
  }
}

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
  multiModule?: { enabled: boolean; modules: string[] },
  sqlByDep?: SqlByDep,
  openApiByDep?: OpenApiByDep,
): void {
  const activeSql = sqlByDep
    ? Object.fromEntries(Object.entries(sqlByDep).filter(([id]) => selected.includes(id)))
    : {}
  const activeOpenApi = openApiByDep
    ? Object.fromEntries(Object.entries(openApiByDep).filter(([id]) => selected.includes(id)))
    : {}
  const hasWizard = Object.keys(activeSql).length > 0 || Object.keys(activeOpenApi).length > 0

  // Branch: any wizard active → single POST carrying both payloads.
  if (hasWizard) {
    void triggerWizardDownload(form, selected, selectedOptions, activeSql, activeOpenApi)
    return
  }

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

async function triggerWizardDownload(
  form: ProjectFormValues,
  selected: string[],
  selectedOptions: Record<string, string[]>,
  activeSql: SqlByDep,
  activeOpenApi: OpenApiByDep,
): Promise<void> {
  const body = buildWizardBody(form, selected, selectedOptions, activeSql, activeOpenApi)
  const res = await fetch('/starter-wizard.zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Wizard generation failed: HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${form.artifactId}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function buildWizardBody(
  form: ProjectFormValues,
  selected: string[],
  selectedOptions: Record<string, string[]>,
  activeSql: SqlByDep,
  activeOpenApi: OpenApiByDep,
): Record<string, unknown> {
  const opts: Record<string, string[]> = {}
  for (const [depId, optIds] of Object.entries(selectedOptions)) {
    if (optIds.length > 0 && selected.includes(depId)) {
      opts[depId] = optIds
    }
  }

  const sqlByDepBody: Record<string, string> = {}
  const sqlOptionsBody: Record<string, { subPackage: string; tables: { name: string; generateRepository: boolean }[] }> = {}
  for (const [depId, entry] of Object.entries(activeSql)) {
    sqlByDepBody[depId] = entry.sql
    sqlOptionsBody[depId] = {
      subPackage: entry.subPackage,
      tables: entry.tables.map(t => ({ name: t.name, generateRepository: t.generateRepository })),
    }
  }

  const specByDep: Record<string, string> = {}
  const openApiOptionsBody: Record<string, {
    apiSubPackage: string
    dtoSubPackage: string
    clientSubPackage: string
    mode: string
    baseUrlProperty: string
  }> = {}
  for (const [depId, entry] of Object.entries(activeOpenApi)) {
    specByDep[depId] = entry.spec
    openApiOptionsBody[depId] = {
      apiSubPackage: entry.apiSubPackage,
      dtoSubPackage: entry.dtoSubPackage,
      clientSubPackage: entry.clientSubPackage,
      mode: entry.mode,
      baseUrlProperty: entry.baseUrlProperty,
    }
  }

  return {
    groupId: form.groupId,
    artifactId: form.artifactId,
    name: form.name,
    description: form.description,
    packageName: form.packageName,
    type: form.type,
    language: form.language,
    bootVersion: form.bootVersion,
    packaging: form.packaging,
    javaVersion: form.javaVersion,
    dependencies: selected,
    opts,
    sqlByDep: sqlByDepBody,
    sqlOptions: sqlOptionsBody,
    specByDep,
    openApiOptions: openApiOptionsBody,
  }
}
