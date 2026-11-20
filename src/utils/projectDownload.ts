// The Backend tab's Generate, once it is clicked — fetched then, so it is not in the entry chunk.
import type { ProjectFormValues, SqlByDep, OpenApiByDep, SoapByDep, EventsByDep } from '../types'
import { buildProjectRequest } from './projectUtils'
import { readErrorBody } from './previewErrors'
import { downloadBlob } from './download'

/**
 * Generates the project and hands the ZIP to the browser. Resolves once the download has
 * started; rejects with a user-facing message when the server refuses, so callers report the
 * failure instead of a false success — and with an `AbortError` when `signal` aborts.
 *
 * Every path is a `fetch` now. The plain one used to be an `<a download>` click, which told the
 * page nothing: no "building" state was possible, and a server error was saved to disk as a
 * broken `.zip`.
 */
export async function triggerDownload(
  form: ProjectFormValues,
  selected: string[],
  selectedOptions: Record<string, string[]>,
  multiModule?: { enabled: boolean; modules: string[] },
  sqlByDep?: SqlByDep,
  openApiByDep?: OpenApiByDep,
  soapByDep?: SoapByDep,
  eventsByDep?: EventsByDep,
  signal?: AbortSignal,
): Promise<{ snapshotId?: string }> {
  const request = buildProjectRequest(
    'zip', form, selected, selectedOptions, multiModule, sqlByDep, openApiByDep, soapByDep, eventsByDep)
  const res = await fetch(request.url, { ...request.init, signal })
  if (!res.ok) {
    const err = await readErrorBody(res)
    throw new Error(err.kind ? `${err.kind}: ${err.message}` : err.message)
  }
  downloadBlob(await res.blob(), `${form.artifactId}.zip`)
  // What the server kept of this project: an update of it starts from those files.
  const id = res.headers?.get?.('X-Snapshot')
  return id && /^[0-9a-f]{64}$/.test(id) ? { snapshotId: id } : {}
}
