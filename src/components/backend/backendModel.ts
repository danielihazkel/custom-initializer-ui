import type {
  EventsByDep, OpenApiByDep, OpenApiMode, ProjectSnapshot, SoapByDep, SoapMode, SqlApiMode, SqlByDep,
} from '../../types'
import { activeWizardEntries, buildWizardBody, defaultForm } from '../../utils/projectUtils'

/**
 * `menora-model.json` of a plain backend, as the generator writes it at a project's root
 * (see *Round 10, phase 5* in backend/CLAUDE.md): `{format, kind, request, generator}`. The
 * `request` is a `/starter-wizard.zip` body — plus `modules` for a multi-module project.
 */
export const BACKEND_MODEL_FORMAT = 'menora-backend-model/1'

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/**
 * The request a snapshot generates: what Generate sends, in the one shape `/starter.patch` and the
 * model file use. A multi-module project (no wizard in play, as on Generate) names its modules.
 */
export function requestOfSnapshot(snapshot: ProjectSnapshot): Json {
  const { form, selected, selectedOptions } = snapshot
  const sql = activeWizardEntries(snapshot.sqlByDep, selected)
  const openApi = activeWizardEntries(snapshot.openApiByDep, selected)
  const soap = activeWizardEntries(snapshot.soapByDep, selected)
  const events = activeWizardEntries(snapshot.eventsByDep, selected)
  const body = buildWizardBody(form, selected, selectedOptions, sql, openApi, soap, events)
  const hasWizard = [sql, openApi, soap, events].some(byDep => Object.keys(byDep).length > 0)
  const multiModule = !hasWizard && snapshot.multiModuleEnabled && snapshot.selectedModules.length > 0
  return multiModule ? { ...body, modules: [...snapshot.selectedModules] } : body
}

/** Whether two snapshots generate the same project — the request is what counts, not the editor's state. */
export function sameProject(a: ProjectSnapshot, b: ProjectSnapshot): boolean {
  return JSON.stringify(requestOfSnapshot(a)) === JSON.stringify(requestOfSnapshot(b))
}

export interface ParsedBackendModel {
  snapshot: ProjectSnapshot
  /** `generator.catalogHash` of the file, when it has one. */
  catalogHash?: string
}

/**
 * Reads a `menora-model.json` (or a bare request) into the Backend tab's snapshot. Returns a
 * message instead when the text is not one — in particular a fullstack project's model, which
 * belongs to the Fullstack tab.
 */
export function parseBackendModel(text: string): ParsedBackendModel | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'The file is not JSON.' }
  }
  if (!isObject(parsed)) return { error: 'The file is not a project model.' }
  const format = str(parsed.format)
  if (format.startsWith('menora-fullstack') || Array.isArray(parsed.entities)) {
    return { error: 'This is a fullstack project\'s model: import it on the Fullstack tab.' }
  }
  if (format && format !== BACKEND_MODEL_FORMAT) {
    return { error: `Unknown model format "${format}": this generator reads ${BACKEND_MODEL_FORMAT}.` }
  }
  const request = isObject(parsed.request) ? parsed.request : parsed
  if (typeof request.artifactId !== 'string' && !Array.isArray(request.dependencies)) {
    return { error: 'The file is not a project model: it names no artifact and no dependencies.' }
  }
  const generator = isObject(parsed.generator) ? parsed.generator : {}
  const catalogHash = str(generator.catalogHash) || undefined
  return { snapshot: snapshotOfRequest(request), ...(catalogHash ? { catalogHash } : {}) }
}

/** A model's request as the editor's snapshot. Fields the request leaves out take the form's defaults. */
export function snapshotOfRequest(request: Json): ProjectSnapshot {
  const defaults = defaultForm(null)
  const pick = (key: keyof typeof defaults) => str(request[key], defaults[key])
  const selected = strings(request.dependencies)
  const selectedOptions: Record<string, string[]> = {}
  if (isObject(request.opts)) {
    for (const [dep, ids] of Object.entries(request.opts)) {
      const list = strings(ids)
      if (list.length > 0) selectedOptions[dep] = list
    }
  }
  const modules = strings(request.modules)
  return {
    form: {
      ...defaults,
      groupId: pick('groupId'),
      artifactId: pick('artifactId'),
      name: str(request.name, str(request.artifactId, defaults.name)),
      description: pick('description'),
      packageName: pick('packageName'),
      bootVersion: pick('bootVersion'),
      javaVersion: pick('javaVersion'),
      packaging: pick('packaging'),
      department: str(request.department),
    },
    selected,
    selectedOptions,
    sqlByDep: sqlOf(request),
    openApiByDep: openApiOf(request),
    soapByDep: soapOf(request),
    ...eventsOf(request),
    multiModuleEnabled: modules.length > 0,
    selectedModules: modules,
  }
}

/** The documents under `textsKey`, each with its options object (empty when the request has none). */
function wizardEntries(request: Json, textsKey: string, optionsKey: string): [string, string, Json][] {
  const texts = isObject(request[textsKey]) ? request[textsKey] as Json : {}
  const options = isObject(request[optionsKey]) ? request[optionsKey] as Json : {}
  return Object.entries(texts)
    .filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].trim() !== '')
    .map(([dep, text]) => [dep, text, isObject(options[dep]) ? options[dep] as Json : {}])
}

function sqlOf(request: Json): SqlByDep {
  const out: SqlByDep = {}
  for (const [dep, sql, o] of wizardEntries(request, 'sqlByDep', 'sqlOptions')) {
    const tables = Array.isArray(o.tables)
      ? o.tables.filter(isObject).filter(t => typeof t.name === 'string')
          .map(t => ({ name: t.name as string, generateRepository: t.generateRepository !== false }))
      : []
    out[dep] = {
      sql,
      subPackage: str(o.subPackage, 'entity'),
      tables,
      apiMode: (str(o.apiMode, 'NONE') as SqlApiMode),
      ...(o.flywayBaseline === false ? { flywayBaseline: false } : {}),
      ...(o.generateTests === true ? { generateTests: true } : {}),
    }
  }
  return out
}

function openApiOf(request: Json): OpenApiByDep {
  const out: OpenApiByDep = {}
  for (const [dep, spec, o] of wizardEntries(request, 'specByDep', 'openApiOptions')) {
    // The server writes the kind as its constant (REST_CLIENT); the editor's is restClient.
    const restClient = str(o.clientKind).replace(/[_-]/g, '').toLowerCase() === 'restclient'
    out[dep] = {
      spec,
      apiSubPackage: str(o.apiSubPackage, 'api'),
      dtoSubPackage: str(o.dtoSubPackage, 'dto'),
      clientSubPackage: str(o.clientSubPackage, 'client'),
      mode: (str(o.mode, 'CONTROLLERS') as OpenApiMode),
      baseUrlProperty: str(o.baseUrlProperty, 'openapi.client.base-url'),
      ...(restClient ? { clientKind: 'restClient' as const } : {}),
      ...(o.copySpec === true ? { copySpec: true } : {}),
    }
  }
  return out
}

function soapOf(request: Json): SoapByDep {
  const out: SoapByDep = {}
  for (const [dep, wsdl, o] of wizardEntries(request, 'wsdlByDep', 'soapOptions')) {
    out[dep] = {
      wsdl,
      endpointSubPackage: str(o.endpointSubPackage, 'endpoint'),
      clientSubPackage: str(o.clientSubPackage, 'client'),
      payloadSubPackage: str(o.payloadSubPackage, 'generated'),
      mode: (str(o.mode, 'ENDPOINTS') as SoapMode),
      baseUrlProperty: str(o.baseUrlProperty, 'soap.client.base-url'),
      contextPath: str(o.contextPath, '/ws'),
    }
  }
  return out
}

/** `eventsByDep` only when the request has an AsyncAPI document: snapshots without one keep their shape. */
function eventsOf(request: Json): { eventsByDep?: EventsByDep } {
  const out: EventsByDep = {}
  for (const [dep, spec, o] of wizardEntries(request, 'asyncApiByDep', 'eventOptions')) {
    out[dep] = {
      spec,
      subPackage: str(o.subPackage, 'events'),
      payloadSubPackage: str(o.payloadSubPackage, 'events.model'),
      groupId: str(o.groupId),
      channels: Array.isArray(o.channels)
        ? o.channels.filter(isObject).filter(c => typeof c.name === 'string')
            .map(c => ({ name: c.name as string, produce: c.produce === true, consume: c.consume === true }))
        : [],
      generateTests: o.generateTests === true,
    }
  }
  return Object.keys(out).length > 0 ? { eventsByDep: out } : {}
}
