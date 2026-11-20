import type { InitializrMetadata, ProjectFormValues, ProjectSnapshot, SqlApiMode, SqlByDep, OpenApiByDep, SoapByDep, EventsByDep } from '../types'
import { readErrorBody } from './previewErrors'
import { t } from '../i18n'

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
  eventsByDep?: EventsByDep
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
    // Only when there is one: snapshots without events keep the shape they had.
    ...(args.eventsByDep && Object.keys(args.eventsByDep).length > 0
      ? { eventsByDep: JSON.parse(JSON.stringify(args.eventsByDep)) as EventsByDep }
      : {}),
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
    'bootVersion', 'language', 'type', 'packaging', 'javaVersion', 'department',
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
    department: '',
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
      errors[field] = t('Required')
    }
  }

  if (!errors.artifactId && /\s/.test(form.artifactId)) {
    errors.artifactId = t('No spaces allowed')
  }

  if (!errors.packageName && !PACKAGE_NAME_RE.test(form.packageName)) {
    errors.packageName = t('Invalid Java package name')
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

/** Which answer is asked for: the ZIP, or the file list the Explore modal and the file dock show. */
export type RequestTarget = 'zip' | 'preview'

/** One call to a generation endpoint, ready for `fetch`. */
export interface ProjectRequest {
  /** Path and query, relative to the app's origin. */
  url: string
  init: RequestInit
  /** `wizard` is a JSON POST carrying the pasted documents; the other two are GETs. */
  kind: 'plain' | 'multimodule' | 'wizard'
  /** Identifies the request: two snapshots with the same key generate the same project. */
  key: string
}

/**
 * The one place a Backend-tab snapshot becomes a request — for Generate, Explore, the file dock,
 * and "Copy as curl". It used to be written out three times (the download, the wizard download
 * and the preview hook), which is how a parameter gets added to one and forgotten in another.
 *
 * Any wizard payload of a still-selected dependency makes it a single POST to the wizard
 * endpoint; otherwise it is a GET, to the multi-module endpoint when modules are ticked.
 */
export function buildProjectRequest(
  target: RequestTarget,
  form: ProjectFormValues,
  selected: string[],
  selectedOptions: Record<string, string[]>,
  multiModule?: { enabled: boolean; modules: string[] },
  sqlByDep?: SqlByDep,
  openApiByDep?: OpenApiByDep,
  soapByDep?: SoapByDep,
  eventsByDep?: EventsByDep,
): ProjectRequest {
  const activeSql = activeWizardEntries(sqlByDep, selected)
  const activeOpenApi = activeWizardEntries(openApiByDep, selected)
  const activeSoap = activeWizardEntries(soapByDep, selected)
  const activeEvents = activeWizardEntries(eventsByDep, selected)
  const hasWizard = [activeSql, activeOpenApi, activeSoap, activeEvents].some(m => Object.keys(m).length > 0)

  if (hasWizard) {
    const url = `/starter-wizard.${target}`
    const body = JSON.stringify(
      buildWizardBody(form, selected, selectedOptions, activeSql, activeOpenApi, activeSoap, activeEvents))
    return {
      url,
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
      kind: 'wizard',
      key: `${url}
${body}`,
    }
  }

  const isMultiModule = Boolean(multiModule?.enabled && multiModule.modules.length > 0)
  const params = new URLSearchParams()
  params.set('type', form.type)
  params.set('language', form.language)
  params.set('bootVersion', form.bootVersion)
  params.set('groupId', form.groupId)
  params.set('artifactId', form.artifactId)
  params.set('name', form.name)
  params.set('description', form.description)
  params.set('packageName', form.packageName)
  params.set('packaging', form.packaging)
  params.set('javaVersion', form.javaVersion)
  if (form.department) params.set('department', form.department)
  if (isMultiModule) params.set('modules', multiModule!.modules.join(','))
  if (selected.length > 0) params.set('dependencies', selected.join(','))
  for (const [depId, optIds] of Object.entries(selectedOptions)) {
    if (optIds.length > 0 && selected.includes(depId)) params.set(`opts-${depId}`, optIds.join(','))
  }
  const url = `/${isMultiModule ? 'starter-multimodule' : 'starter'}.${target}?${params.toString()}`
  return { url, init: {}, kind: isMultiModule ? 'multimodule' : 'plain', key: url }
}

/**
 * Generates the project and hands the ZIP to the browser. Resolves once the download has
 * started; rejects with a user-facing message when the server refuses, so callers report the
 * failure instead of a false success — and with an `AbortError` when `signal` aborts.
 *
 * Every path is a `fetch` now. The plain one used to be an `<a download>` click, which told the
 * page nothing: no "building" state was possible, and a server error was saved to disk as a
 * broken `.zip`.
 */
export async function triggerDownload(
  form: ProjectFormValues,
  selected: string[],
  selectedOptions: Record<string, string[]>,
  multiModule?: { enabled: boolean; modules: string[] },
  sqlByDep?: SqlByDep,
  openApiByDep?: OpenApiByDep,
  soapByDep?: SoapByDep,
  eventsByDep?: EventsByDep,
  signal?: AbortSignal,
): Promise<{ snapshotId?: string }> {
  const request = buildProjectRequest(
    'zip', form, selected, selectedOptions, multiModule, sqlByDep, openApiByDep, soapByDep, eventsByDep)
  const res = await fetch(request.url, { ...request.init, signal })
  if (!res.ok) {
    const err = await readErrorBody(res)
    throw new Error(err.kind ? `${err.kind}: ${err.message}` : err.message)
  }
  downloadBlob(await res.blob(), `${form.artifactId}.zip`)
  // What the server kept of this project: an update of it starts from those files.
  const id = res.headers?.get?.('X-Snapshot')
  return id && /^[0-9a-f]{64}$/.test(id) ? { snapshotId: id } : {}
}

/** Hands a Blob to the browser as a file download (anchor click) and releases the object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * The selected dependencies that carry a wizard payload. With any, the project goes to the
 * wizard endpoint — which generates one module, whatever the multi-module switch says: the
 * wizards' code cannot be placed in modules. The module selector says so while both are set.
 */
export function wizardDepIds(
  selected: string[],
  sqlByDep?: SqlByDep,
  openApiByDep?: OpenApiByDep,
  soapByDep?: SoapByDep,
  eventsByDep?: EventsByDep,
): string[] {
  const withWizard = new Set<string>()
  for (const byDep of [sqlByDep, openApiByDep, soapByDep, eventsByDep]) {
    for (const id of Object.keys(activeWizardEntries<unknown>(byDep, selected))) withWizard.add(id)
  }
  return selected.filter(id => withWizard.has(id))
}

/** The wizard entries of dependencies that are still selected. */
export function activeWizardEntries<T>(byDep: Record<string, T> | undefined, selected: string[]): Record<string, T> {
  return byDep ? Object.fromEntries(Object.entries(byDep).filter(([id]) => selected.includes(id))) : {}
}

export function buildWizardBody(
  form: ProjectFormValues,
  selected: string[],
  selectedOptions: Record<string, string[]>,
  activeSql: SqlByDep,
  activeOpenApi: OpenApiByDep,
  activeSoap: SoapByDep,
  activeEvents: EventsByDep = {},
): Record<string, unknown> {
  const opts: Record<string, string[]> = {}
  for (const [depId, optIds] of Object.entries(selectedOptions)) {
    if (optIds.length > 0 && selected.includes(depId)) {
      opts[depId] = optIds
    }
  }

  const sqlByDepBody: Record<string, string> = {}
  const sqlOptionsBody: Record<string, {
    subPackage: string
    tables: { name: string; generateRepository: boolean }[]
    apiMode: string
    flywayBaseline?: boolean
    generateTests?: boolean
  }> = {}
  for (const [depId, entry] of Object.entries(activeSql)) {
    sqlByDepBody[depId] = entry.sql
    sqlOptionsBody[depId] = {
      subPackage: entry.subPackage,
      tables: entry.tables.map(t => ({ name: t.name, generateRepository: t.generateRepository })),
      apiMode: entry.apiMode ?? 'NONE',
      // Sent only when they differ from the server's defaults (baseline on, tests off).
      ...(entry.flywayBaseline === false ? { flywayBaseline: false } : {}),
      // A test needs a controller: nothing to send without a REST stack.
      ...(entry.generateTests && (entry.apiMode ?? 'NONE') !== 'NONE' ? { generateTests: true } : {}),
    }
  }

  const specByDep: Record<string, string> = {}
  const openApiOptionsBody: Record<string, {
    apiSubPackage: string
    dtoSubPackage: string
    clientSubPackage: string
    mode: string
    baseUrlProperty: string
    clientKind?: string
    copySpec?: boolean
    apiStyle?: string
  }> = {}
  for (const [depId, entry] of Object.entries(activeOpenApi)) {
    specByDep[depId] = entry.spec
    openApiOptionsBody[depId] = {
      apiSubPackage: entry.apiSubPackage,
      dtoSubPackage: entry.dtoSubPackage,
      clientSubPackage: entry.clientSubPackage,
      mode: entry.mode,
      baseUrlProperty: entry.baseUrlProperty,
      // Sent only where they differ from the server's defaults; a client kind needs a client.
      ...(entry.clientKind === 'restClient' && entry.mode !== 'CONTROLLERS' ? { clientKind: 'restClient' } : {}),
      ...(entry.copySpec ? { copySpec: true } : {}),
      // Interfaces need a server side; classes are what the server writes without the option.
      ...(entry.apiStyle === 'interfaces' && entry.mode !== 'CLIENT' ? { apiStyle: 'interfaces' } : {}),
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
  let wsdlFilesByDep: Record<string, Record<string, string>> | undefined
  for (const [depId, entry] of Object.entries(activeSoap)) {
    wsdlByDep[depId] = entry.wsdl
    if (entry.files) (wsdlFilesByDep ??= {})[depId] = entry.files
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
    department: form.department || undefined,
    dependencies: selected,
    opts,
    sqlByDep: sqlByDepBody,
    sqlOptions: sqlOptionsBody,
    specByDep,
    openApiOptions: openApiOptionsBody,
    wsdlByDep,
    soapOptions: soapOptionsBody,
    // Only for a WSDL in several files: undefined is left out of the JSON, so requests without one
    // keep the shape they had.
    wsdlFilesByDep,
    // Only with an events entry: requests without one keep the shape they had.
    ...eventsBody(activeEvents),
  }
}

/** `asyncApiByDep` + `eventOptions` for the events wizard's entries; nothing when there are none. */
function eventsBody(activeEvents: EventsByDep): Record<string, unknown> {
  const ids = Object.keys(activeEvents)
  if (ids.length === 0) return {}
  const asyncApiByDep: Record<string, string> = {}
  const eventOptions: Record<string, Record<string, unknown>> = {}
  for (const depId of ids) {
    const entry = activeEvents[depId]
    asyncApiByDep[depId] = entry.spec
    eventOptions[depId] = {
      subPackage: entry.subPackage,
      payloadSubPackage: entry.payloadSubPackage,
      ...(entry.groupId.trim() ? { groupId: entry.groupId.trim() } : {}),
      // No list: the server follows the document (the project is the application it describes).
      ...(entry.channels.length > 0 ? { channels: entry.channels } : {}),
      ...(entry.generateTests ? { generateTests: true } : {}),
      schemaRegistry: entry.schemaRegistry, // undefined: left out of the JSON
    }
  }
  return { asyncApiByDep, eventOptions }
}
