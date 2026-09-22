import type { ExampleModel, FullstackEntityDef, FullstackPageDef } from '../../types'

// The examples themselves are admin-managed (Admin → Fullstack Examples) and served by
// GET /metadata/fullstack/examples — see hooks/useFullstackExamples.
export type { ExampleModel }

/** Deep copy so the loaded model can be edited without touching the catalog entry. */
export function cloneExample(example: ExampleModel): FullstackEntityDef[] {
  return JSON.parse(JSON.stringify(example.entities)) as FullstackEntityDef[]
}

/** Deep copy of the example's page layout; [] (the classic shell) when it has none. */
export function cloneExamplePages(example: ExampleModel): FullstackPageDef[] {
  return example.pages ? JSON.parse(JSON.stringify(example.pages)) as FullstackPageDef[] : []
}
