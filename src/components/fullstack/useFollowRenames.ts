import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { renameEntityInRelations } from './relationRefs'
import { renameLinkInChildLists } from './childLists'
import { renameLinkedFieldInRules, renameLinkInRules } from './rules'
import { renameEntityInPages, renameEnumValueInPages, renameFieldInPages, renameRelationInPages } from './pageLayout'

/**
 * A page layout names entities and fields; the editor renames them by uid, so the references
 * follow instead of breaking. (A *deleted* entity is left in place and flagged — silently
 * dropping the page that shows it would lose more than it saves.)
 *
 * `followsModelRef` is raised when the layout (or another entity) is rewritten to follow a
 * rename, so that the undo history files both as one step.
 */
export function useFollowRenames(
  entities: FullstackEntityDef[],
  setPages: Dispatch<SetStateAction<FullstackPageDef[]>>,
  setEntities: Dispatch<SetStateAction<FullstackEntityDef[]>>,
  followsModelRef: MutableRefObject<boolean>,
): void {
  const namesByUidRef = useRef<Map<string, string>>(new Map())
  const enumValuesByUidRef = useRef<Map<string, string[]>>(new Map())
  useEffect(() => {
    const before = namesByUidRef.current
    const now = new Map<string, string>()
    const enumsBefore = enumValuesByUidRef.current
    const enumsNow = new Map<string, string[]>()
    let follow: ((ps: FullstackPageDef[]) => FullstackPageDef[])[] = []
    const followPages = (fn: (ps: FullstackPageDef[]) => FullstackPageDef[]) => { follow = [...follow, fn] }
    // Relations name their target entity, so an entity rename follows into them too.
    let followTargets: ((es: FullstackEntityDef[]) => FullstackEntityDef[])[] = []
    for (const e of entities) {
      // A name cleared on the way to a new one keeps its last spelling here, so the references
      // that still say it follow once the new name is typed.
      if (e.uid) now.set(e.uid, e.name.trim() ? e.name : (before.get(e.uid) ?? e.name))
      for (const f of e.fields) {
        if (!f.uid) continue
        now.set(f.uid, `${e.name}.${f.name}`)
        if (f.type !== 'ENUM' || !f.enumValues) continue
        enumsNow.set(f.uid, f.enumValues)
        // A value renamed in place: same list length, exactly one position changed.
        const was = enumsBefore.get(f.uid)
        if (!was || was === f.enumValues || was.length !== f.enumValues.length) continue
        const diff = f.enumValues.flatMap((v, i) => (v !== was[i] ? [i] : []))
        if (diff.length === 1) {
          const [i] = diff
          followPages(ps => renameEnumValueInPages(ps, e.name, f.name, was[i], f.enumValues![i]))
        }
      }
      for (const r of e.relations ?? []) if (r.uid) now.set(r.uid, `${e.name}#${r.fieldName}`)
    }
    enumValuesByUidRef.current = enumsNow
    if (before.size > 0) {
      for (const [uid, name] of now) {
        const was = before.get(uid)
        if (!was || was === name) continue
        if (was.includes('#')) {
          const [, wasRelation] = was.split('#')
          const [nowEntity, nowRelation] = name.split('#')
          if (nowRelation?.trim()) {
            followPages(ps => renameRelationInPages(ps, nowEntity, wasRelation, nowRelation))
            // The one-to-manys that read this link by name.
            followTargets = [...followTargets, es => renameLinkInChildLists(es, nowEntity, wasRelation, nowRelation)]
            // The rules that read through this link (costCenter.budget).
            followTargets = [...followTargets, es => renameLinkInRules(es, nowEntity, wasRelation, nowRelation)]
          }
          continue
        }
        const [wasEntity, wasField] = was.split('.')
        const [nowEntity, nowField] = name.split('.')
        if (wasField == null && nowEntity.trim()) {
          followPages(ps => renameEntityInPages(ps, wasEntity, nowEntity))
          // Only while the old name meant one entity: with two entities of that name there is
          // no telling whose relations these are.
          const sharedName = [...before].filter(([otherUid, other]) => otherUid !== uid
            && !other.includes('.') && !other.includes('#')
            && other.trim().toLowerCase() === wasEntity.trim().toLowerCase()).length > 0
          if (!sharedName) followTargets = [...followTargets, es => renameEntityInRelations(es, wasEntity, nowEntity)]
        } else if (wasField != null && nowField?.trim() && wasField !== nowField) {
          followPages(ps => renameFieldInPages(ps, nowEntity, wasField, nowField))
          // Other entities' rules that read this field through a link.
          followTargets = [...followTargets, es => renameLinkedFieldInRules(es, nowEntity, wasField, nowField)]
        }
      }
    }
    namesByUidRef.current = now
    if (follow.length > 0) {
      // The layout follows the model edit that caused it: one undo step for both.
      setPages(ps => {
        const next = follow.reduce((acc, fn) => fn(acc), ps)
        if (next !== ps) followsModelRef.current = true
        return next
      })
    }
    if (followTargets.length > 0) {
      // Same undo step as the rename, like the layout. The flag is raised inside the updater —
      // that runs with the next render, after this commit's recording effect has filed the
      // rename itself.
      setEntities(es => {
        const next = followTargets.reduce((acc, fn) => fn(acc), es)
        if (next !== es) followsModelRef.current = true
        return next
      })
    }
  }, [entities, setPages, setEntities, followsModelRef])
}
