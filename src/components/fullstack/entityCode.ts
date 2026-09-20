import type { FullstackEntityDef, PreviewFile } from '../../types'
import { toKebabCase, toPascalCase } from './naming'

/**
 * Picks the generated files that belong to one entity out of a whole-project preview.
 *
 * The card already *describes* what it will generate (the endpoint list); this is the same answer
 * in the generator's own words. `POST /starter-fullstack.preview` already returns every file's
 * content, so showing the Java and TSX for one entity costs nothing beyond a filter — no extra
 * endpoint, no second round-trip.
 */
export interface EntityCodeFile {
  /** Full path inside the generated project. */
  path: string
  content: string
  /** `backend/src/.../UserController.java` → `UserController.java`. */
  name: string
  side: 'backend' | 'frontend'
}

/**
 * The per-entity backend files, in the order a reader wants them — the entity first, then the
 * layers built on it. Mirrors the `perEntity` entries of the `spring-jpa-crud` manifest; a suffix
 * that is not listed simply does not match, which is what keeps `User` from claiming
 * `UserGroupController.java`.
 */
const JAVA_SUFFIXES = ['', 'Id', 'Repository', 'Dto', 'Service', 'Controller', 'ControllerTest']

/** Frontend order, mirroring the `react-tailwind-crud` manifest's FSD layout. */
const FE_ORDER = ['types.ts', 'index.ts', 'validate.ts']

export function entityCodeFiles(entity: FullstackEntityDef, files: PreviewFile[] | undefined): EntityCodeFile[] {
  const name = entity.name.trim()
  if (!name || !files?.length) return []
  const pascal = toPascalCase(name)
  const kebab = toKebabCase(name)

  // The generated frontend is Feature-Sliced: one slice per layer, all keyed by the singular
  // kebab name. Matching the folder (not the file name) is what catches `use<Entity>.ts`,
  // `types.ts` and the barrels, which carry no entity name of their own.
  const feFolders = [`/entities/${kebab}/`, `/features/${kebab}-form/`, `/pages/${kebab}/`]
  const javaNames = JAVA_SUFFIXES.map(suffix => `${pascal}${suffix}.java`)

  const matched: EntityCodeFile[] = []
  for (const file of files) {
    const base = file.path.split('/').pop() ?? file.path
    const javaRank = javaNames.indexOf(base)
    const inFeature = feFolders.some(folder => file.path.includes(folder))
    if (javaRank < 0 && !inFeature) continue
    matched.push({
      path: file.path,
      content: file.content,
      name: base,
      side: file.path.startsWith('frontend/') ? 'frontend' : 'backend',
    })
  }

  return matched.sort((a, b) => rank(a, pascal, javaNames) - rank(b, pascal, javaNames) || a.path.localeCompare(b.path))
}

function rank(file: EntityCodeFile, pascal: string, javaNames: string[]): number {
  const java = javaNames.indexOf(file.name)
  if (java >= 0) return java
  // A frontend file named after the entity (Form / Detail / Page) outranks the plumbing.
  if (file.name.startsWith(pascal)) return 100
  const fe = FE_ORDER.indexOf(file.name)
  return fe >= 0 ? 110 + fe : 120
}
