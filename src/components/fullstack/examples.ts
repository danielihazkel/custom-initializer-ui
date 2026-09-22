import type { ExampleModel, FullstackEntityDef } from '../../types'

// The examples themselves are admin-managed (Admin → Fullstack Examples) and served by
// GET /metadata/fullstack/examples — see hooks/useFullstackExamples.
export type { ExampleModel }

/** Deep copy so the loaded model can be edited without touching the catalog entry. */
export function cloneExample(example: ExampleModel): FullstackEntityDef[] {
  return JSON.parse(JSON.stringify(example.entities)) as FullstackEntityDef[]
}
