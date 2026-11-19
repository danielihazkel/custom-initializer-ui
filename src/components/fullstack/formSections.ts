import type { FullstackEntityDef, FullstackFormSection } from '../../types'
import { askableFields } from './pageLayout'
import { LIMITS } from './schema'
import { t } from '../../i18n'

/** Mirrors FullstackRequestValidator.MAX_FORM_SECTIONS / MAX_SECTION_TITLE. */
export const MAX_FORM_SECTIONS = LIMITS.maxFormSections
export const MAX_SECTION_TITLE = LIMITS.maxSectionTitle

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
  // A section lists fields and foreign keys; a many-to-many is drawn after the sections.
  const names = new Set([...after.fields.map(f => f.name),
    ...(after.relations ?? []).filter(r => r.type === 'MANY_TO_ONE').map(r => r.fieldName)])
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
  if (sections.length > MAX_FORM_SECTIONS) return t('At most {max} form sections', { max: MAX_FORM_SECTIONS })
  const askable = new Set(askableFields(entity).map(a => a.name.toLowerCase()))
  const seen = new Set<string>()
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    const n = i + 1
    if (!s.title.trim()) return t('Form section {n} needs a title', { n })
    if (s.title.trim().length > MAX_SECTION_TITLE) return t('Form section {n} has a title over {max} characters', { n, max: MAX_SECTION_TITLE })
    if (s.fields.length === 0) return t('Form section {n} (“{title}”) lists no fields', { n, title: s.title.trim() })
    for (const name of s.fields) {
      const key = name.trim().toLowerCase()
      if (!askable.has(key)) return t('Form section {n} (“{title}”) lists “{field}”, which is not one of its fields or relations', { n, title: s.title.trim(), field: name })
      if (seen.has(key)) return t('“{field}” is in two form sections', { field: name })
      seen.add(key)
    }
  }
  return undefined
}
