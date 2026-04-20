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
  // Branch: OpenAPI wizard requires POST (JSON body carrying spec text).
  // Takes precedence over SQL wizard when both are attached (v1: mutually exclusive).
  const activeOpenApi = openApiByDep
    ? Object.fromEntries(Object.entries(openApiByDep).filter(([id]) => selected.includes(id)))
    : {}
  if (Object.keys(activeOpenApi).length > 0) {
    triggerOpenApiDownload(form, selected, selectedOptions, activeOpenApi)
    return
  }

  // Branch: SQL wizard requires POST (JSON body carrying CREATE TABLE scripts)
  const activeSql = sqlByDep
    ? Object.fromEntries(Object.entries(sqlByDep).filter(([id]) => selected.includes(id)))
    : {}
  if (Object.keys(activeSql).length > 0) {
    triggerSqlDownload(form, selected, selectedOptions, activeSql)
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

async function triggerOpenApiDownload(
  form: ProjectFormValues,
  selected: string[],
  selectedOptions: Record<string, string[]>,
  openApiByDep: OpenApiByDep,
): Promise<void> {
  const opts: Record<string, string[]> = {}
  for (const [depId, optIds] of Object.entries(selectedOptions)) {
    if (optIds.length > 0 && selected.includes(depId)) {
      opts[depId] = optIds
    }
  }
  const specByDep: Record<string, string> = {}
  const openApiOptions: Record<string, { apiSubPackage: string; dtoSubPackage: string }> = {}
  for (const [depId, entry] of Object.entries(openApiByDep)) {
    specByDep[depId] = entry.spec
    openApiOptions[depId] = {
      apiSubPackage: entry.apiSubPackage,
      dtoSubPackage: entry.dtoSubPackage,
    }
  }
  const body = {
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
    specByDep,
    openApiOptions,
  }
  const res = await fetch('/starter-openapi.zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`OpenAPI generation failed: HTTP ${res.status}`)
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

async function triggerSqlDownload(
  form: ProjectFormValues,
  selected: string[],
  selectedOptions: Record<string, string[]>,
  sqlByDep: SqlByDep,
): Promise<void> {
  const opts: Record<string, string[]> = {}
  for (const [depId, optIds] of Object.entries(selectedOptions)) {
    if (optIds.length > 0 && selected.includes(depId)) {
      opts[depId] = optIds
    }
  }
  const sqlByDepBody: Record<string, string> = {}
  const sqlOptionsBody: Record<string, { subPackage: string; tables: { name: string; generateRepository: boolean }[] }> = {}
  for (const [depId, entry] of Object.entries(sqlByDep)) {
    sqlByDepBody[depId] = entry.sql
    sqlOptionsBody[depId] = {
      subPackage: entry.subPackage,
      tables: entry.tables.map(t => ({ name: t.name, generateRepository: t.generateRepository })),
    }
  }
  const body = {
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
  }
  const res = await fetch('/starter-sql.zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`SQL generation failed: HTTP ${res.status}`)
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
