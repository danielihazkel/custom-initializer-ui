import type { FullstackEntityDef, FullstackFormSection } from '../../types'
import { askableFields } from './pageLayout'

/** Mirrors FullstackRequestValidator.MAX_FORM_SECTIONS / MAX_SECTION_TITLE. */
export const MAX_FORM_SECTIONS = 6
export const MAX_SECTION_TITLE = 60

/**
 * An entity's form sections after an edit: a renamed field or relation (matched by uid) is
 * renamed in its section, one that is gone is dropped, and a section left with nothing is
 * removed. Anything else stays as the user wrote it.
 */
export function syncFormSections(before: FullstackEntityDef, after: FullstackEntityDef): FullstackEntityDef {
  if (!after.formSections?.length) return after
  const renamed = new Map<string, string>()
  for (const f of after.fields) {
    const was = f.uid ? before.fields.find(x => x.uid === f.uid) : undefined
    if (was && was.name !== f.name) renamed.set(was.name, f.name)
  }
  for (const r of after.relations ?? []) {
    const was = r.uid ? (before.relations ?? []).find(x => x.uid === r.uid) : undefined
    if (was && was.fieldName !== r.fieldName) renamed.set(was.fieldName, r.fieldName)
  }
  const names = new Set([...after.fields.map(f => f.name), ...(after.relations ?? []).map(r => r.fieldName)])
  let changed = false
  const sections: FullstackFormSection[] = []
  for (const s of after.formSections) {
    const fields = s.fields.map(n => renamed.get(n) ?? n).filter(n => names.has(n))
    if (fields.length !== s.fields.length || fields.some((n, i) => n !== s.fields[i])) changed = true
    if (fields.length === 0 && s.fields.length > 0) { changed = true; continue }
    sections.push(fields === s.fields ? s : { ...s, fields })
  }
  if (!changed) return after
  return { ...after, formSections: sections.length ? sections : undefined }
}

/** Why an entity's form sections would be rejected (FullstackRequestValidator.parseFormSections), or undefined. */
export function formSectionsProblem(entity: FullstackEntityDef): string | undefined {
  const sections = entity.formSections ?? []
  if (sections.length === 0) return undefined
  if (sections.length > MAX_FORM_SECTIONS) return `At most ${MAX_FORM_SECTIONS} form sections`
  const askable = new Set(askableFields(entity).map(a => a.name.toLowerCase()))
  const seen = new Set<string>()
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    const where = `Form section ${i + 1}`
    if (!s.title.trim()) return `${where} needs a title`
    if (s.title.trim().length > MAX_SECTION_TITLE) return `${where} has a title over ${MAX_SECTION_TITLE} characters`
    if (s.fields.length === 0) return `${where} (“${s.title.trim()}”) lists no fields`
    for (const name of s.fields) {
      const key = name.trim().toLowerCase()
      if (!askable.has(key)) return `${where} (“${s.title.trim()}”) lists “${name}”, which is not one of its fields or relations`
      if (seen.has(key)) return `“${name}” is in two form sections`
      seen.add(key)
    }
  }
  return undefined
}
