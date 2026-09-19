import type { FullstackEntityDef } from '../../types'
import { newUid } from './uid'
import { toCamelCase, toPascalCase, uniqueName } from './naming'

/**
 * The join entity that models a many-to-many between `owner` and `target` with the relations the
 * generator supports (two required MANY_TO_ONEs): `OrderProduct { id; order → Order; product →
 * Product }`. The name is uniquified against the existing entities; a self-join gets distinct
 * relation names (`parent` / `parent2`) so the row still validates.
 */
export function joinEntity(owner: string, target: string, existingNames: readonly string[]): FullstackEntityDef {
  const ownerName = owner.trim()
  const targetName = target.trim()
  const ownerRel = toCamelCase(ownerName)
  const targetRel = uniqueName(toCamelCase(targetName), [ownerRel, 'id'])
  return {
    uid: newUid(),
    name: uniqueName(`${toPascalCase(ownerName)}${toPascalCase(targetName)}`, existingNames),
    fields: [{ uid: newUid(), name: 'id', type: 'LONG', primaryKey: true, generated: true }],
    relations: [
      { uid: newUid(), type: 'MANY_TO_ONE', fieldName: ownerRel, targetEntity: ownerName, required: true },
      { uid: newUid(), type: 'MANY_TO_ONE', fieldName: targetRel, targetEntity: targetName, required: true },
    ],
  }
}
