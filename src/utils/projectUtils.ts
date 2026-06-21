import type { InitializrMetadata, ProjectFormValues, ProjectSnapshot, SqlApiMode, SqlByDep, OpenApiByDep, SoapByDep } from '../types'

// Dependencies the SQL wizard's generated code needs for a given api mode:
// data-jpa (entities + repositories, every mode), web (REST controllers, any
// mode != NONE), mapstruct (the @Mapper interface, MAPSTRUCT_DTO only).
export function requiredSqlDeps(apiMode: SqlApiMode): string[] {
  const req = ['data-jpa']
  if (apiMode !== 'NONE') req.push('web')
  if (apiMode === 'MAPSTRUCT_DTO') req.push('mapstruct')
  return req
}

// A required dep is satisfied when selected; webflux also satisfies `web`.
export function isSqlDepSatisfied(dep: string, selected: string[]): boolean {
  return selected.includes(dep) || (dep === 'web' && selected.includes('webflux'))
}

export function captureSnapshot(args: {
  form: ProjectFormValues
  selected: string[]
  selectedOptions: Record<string, string[]>
  sqlByDep: SqlByDep
  openApiByDep: OpenApiByDep
  soapByDep: SoapByDep
  multiModuleEnabled: boolean
  selectedModules: string[]
}): ProjectSnapshot {
  return {
    form: { ...args.form },
    selected: [...args.selected],
    selectedOptions: JSON.parse(JSON.stringify(args.selectedOptions)),
    sqlByDep: JSON.parse(JSON.stringify(args.sqlByDep)),
    openApiByDep: JSON.parse(JSON.stringify(args.openApiByDep)),
    soapByDep: JSON.parse(JSON.stringify(args.soapByDep)),
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
  if (p.get('tab') === 'frontend') return null
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

/** Fields the user must fill for a valid project. Mirrors ProjectForm's required set. */
const REQUIRED_FIELDS = ['groupId', 'artifactId', 'name', 'packageName'] as const

/** Valid Java package: dot-separated identifiers, each starting with a letter or underscore. */
const PACKAGE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/

export type FormErrors = Partial<Record<keyof ProjectFormValues, string>>

/**
 * Validates the user-editable project metadata. Returns per-field error messages
 * so the form can surface specifics and the Generate/Explore actions can be gated.
 */
export function validateForm(form: ProjectFormValues): { valid: boolean; errors: FormErrors } {
  const errors: FormErrors = {}

  for (const field of REQUIRED_FIELDS) {
    if (form[field].trim() === '') {
      errors[field] = 'Required'
    }
  }

  if (!errors.artifactId && /\s/.test(form.artifactId)) {
    errors.artifactId = 'No spaces allowed'
  }

  if (!errors.packageName && !PACKAGE_NAME_RE.test(form.packageName)) {
    errors.packageName = 'Invalid Java package name'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export function triggerDownload(
  form: ProjectFormValues,
  selected: string[],
  selectedOptions: Record<string, string[]>,
  multiModule?: { enabled: boolean; modules: string[] },
  sqlByDep?: SqlByDep,
  openApiByDep?: OpenApiByDep,
  soapByDep?: SoapByDep,
): void {
  const activeSql = sqlByDep
    ? Object.fromEntries(Object.entries(sqlByDep).filter(([id]) => selected.includes(id)))
    : {}
  const activeOpenApi = openApiByDep
    ? Object.fromEntries(Object.entries(openApiByDep).filter(([id]) => selected.includes(id)))
    : {}
  const activeSoap = soapByDep
    ? Object.fromEntries(Object.entries(soapByDep).filter(([id]) => selected.includes(id)))
    : {}
  const hasWizard = Object.keys(activeSql).length > 0
      || Object.keys(activeOpenApi).length > 0
      || Object.keys(activeSoap).length > 0

  // Branch: any wizard active → single POST carrying all payloads.
  if (hasWizard) {
    void triggerWizardDownload(form, selected, selectedOptions, activeSql, activeOpenApi, activeSoap)
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
  activeSoap: SoapByDep,
): Promise<void> {
  const body = buildWizardBody(form, selected, selectedOptions, activeSql, activeOpenApi, activeSoap)
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
  activeSoap: SoapByDep,
): Record<string, unknown> {
  const opts: Record<string, string[]> = {}
  for (const [depId, optIds] of Object.entries(selectedOptions)) {
    if (optIds.length > 0 && selected.includes(depId)) {
      opts[depId] = optIds
    }
  }

  const sqlByDepBody: Record<string, string> = {}
  const sqlOptionsBody: Record<string, { subPackage: string; tables: { name: string; generateRepository: boolean }[]; apiMode: string }> = {}
  for (const [depId, entry] of Object.entries(activeSql)) {
    sqlByDepBody[depId] = entry.sql
    sqlOptionsBody[depId] = {
      subPackage: entry.subPackage,
      tables: entry.tables.map(t => ({ name: t.name, generateRepository: t.generateRepository })),
      apiMode: entry.apiMode ?? 'NONE',
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

  const wsdlByDep: Record<string, string> = {}
  const soapOptionsBody: Record<string, {
    endpointSubPackage: string
    clientSubPackage: string
    payloadSubPackage: string
    mode: string
    baseUrlProperty: string
    contextPath: string
  }> = {}
  for (const [depId, entry] of Object.entries(activeSoap)) {
    wsdlByDep[depId] = entry.wsdl
    soapOptionsBody[depId] = {
      endpointSubPackage: entry.endpointSubPackage,
      clientSubPackage: entry.clientSubPackage,
      payloadSubPackage: entry.payloadSubPackage,
      mode: entry.mode,
      baseUrlProperty: entry.baseUrlProperty,
      contextPath: entry.contextPath,
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
    wsdlByDep,
    soapOptions: soapOptionsBody,
  }
}
