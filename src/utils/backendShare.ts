import type { ProjectFormValues, ProjectSnapshot } from '../types'
import { decodeJson, encodeJson } from './base64url'

/**
 * The Backend tab's whole state in its share link. The plain parameters (`groupId`,
 * `dependencies`, `opts-*`, …) carry the form and the dependencies, as start.spring.io's do; what
 * they cannot carry — the modules and the wizards' documents — rides in this one parameter,
 * the whole snapshot encoded, and only when there is any (a plain setup keeps a readable link).
 */
export const BACKEND_SHARE_PARAM = 'bs'

/** Links longer than this are refused by some proxies and browsers; past it the link drops `bs`. */
export const MAX_BACKEND_SHARE_LENGTH = 60_000

/** Whether a setup has anything the plain parameters cannot carry. */
export function carriesMoreThanParams(s: ProjectSnapshot): boolean {
  return (s.multiModuleEnabled && s.selectedModules.length > 0)
    || Object.keys(s.sqlByDep).length > 0
    || Object.keys(s.openApiByDep).length > 0
    || Object.keys(s.soapByDep).length > 0
    || Object.keys(s.eventsByDep ?? {}).length > 0
}

export function encodeBackendShare(s: ProjectSnapshot): string {
  return encodeJson(s)
}

export function decodeBackendShare(value: string): ProjectSnapshot | null {
  return parseProjectSnapshot(decodeJson(value))
}

/** The snapshot in the current URL's `bs`, or null (none, or not one). */
export function readBackendShare(search: string = window.location.search): ProjectSnapshot | null {
  try {
    const value = new URLSearchParams(search).get(BACKEND_SHARE_PARAM)
    return value ? decodeBackendShare(value) : null
  } catch {
    return null
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/**
 * A Backend-tab snapshot from something that came from outside (a link, a team preset): the shape
 * is checked and the lists cleaned, the wizard entries are passed on for `applySnapshot` to
 * normalise like stored ones. Null when it is not a snapshot at all.
 */
export function parseProjectSnapshot(raw: unknown): ProjectSnapshot | null {
  if (!isRecord(raw) || !isRecord(raw.form) || !Array.isArray(raw.selected)) return null
  const form: Partial<ProjectFormValues> = {}
  for (const [k, v] of Object.entries(raw.form)) {
    if (typeof v === 'string') (form as Record<string, string>)[k] = v
  }
  const selectedOptions: Record<string, string[]> = {}
  if (isRecord(raw.selectedOptions)) {
    for (const [k, v] of Object.entries(raw.selectedOptions)) selectedOptions[k] = strings(v)
  }
  const record = <T,>(v: unknown): T => (isRecord(v) ? v : {}) as T
  return {
    form: form as ProjectFormValues,
    selected: strings(raw.selected),
    selectedOptions,
    sqlByDep: record(raw.sqlByDep),
    openApiByDep: record(raw.openApiByDep),
    soapByDep: record(raw.soapByDep),
    ...(isRecord(raw.eventsByDep) ? { eventsByDep: record(raw.eventsByDep) } : {}),
    multiModuleEnabled: raw.multiModuleEnabled === true,
    selectedModules: strings(raw.selectedModules),
  }
}
