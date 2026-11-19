import type { ProjectSnapshot } from '../../types'
import { activeWizardEntries, buildWizardBody } from '../../utils/projectUtils'

// Kept apart from ./backendModel (the model file's reader, fetched when a model is imported) so
// the entry chunk carries only what the Backend tab needs at first paint.

type Json = Record<string, unknown>

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
