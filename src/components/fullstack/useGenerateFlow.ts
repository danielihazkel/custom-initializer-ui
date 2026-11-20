import { useEffect, useRef, type MutableRefObject } from 'react'
import type { FullstackEntityDef, FullstackStarterRequest, Toast } from '../../types'
import { toExportedModel, type FullstackSnapshot } from './snapshot'
import { schemaVersionOf, type UpdateBaseline } from './updateBaseline'
import { snapshotHeader } from '../../utils/updateCounts'
import { describeServerTarget, type ServerIssue, type ServerTarget } from './serverIssue'
import { readErrorBody } from '../../utils/previewErrors'
import { summarizeEntity } from './summary'
import { scrollToElement } from './scroll'
import type { GeneratedRun } from './NextStepsPanel'
import { t } from '../../i18n'

export interface GenerateFlowOptions {
  currentSnapshot: FullstackSnapshot
  snapshotRef: MutableRefObject<FullstackSnapshot>
  artifactId: string
  entities: FullstackEntityDef[]
  scaffoldOpts: string[]
  /** False (after saying why and jumping there) while the model has problems. */
  validateBeforeSubmit: () => boolean
  buildBody: () => FullstackStarterRequest
  setGenerating: (generating: boolean) => void
  /** Keeps the model among the recent ones. */
  pushRecent: (snapshot: FullstackSnapshot) => void
  /** The project now in the user's hands was made from this model. */
  setBaseline: (baseline: UpdateBaseline | null) => void
  setLastGenerated: (run: GeneratedRun | null) => void
  /** Puts a server's refusal on the entity, field or page it names. */
  showServerIssue: (issue: ServerIssue) => ServerTarget | null
  setToast: (toast: Toast) => void
}

/**
 * Generate: `POST /starter-fullstack.zip`, the download, and what follows a success (the recent
 * models, the update baseline, the next-steps card) or a refusal (shown where it is).
 */
export function useGenerateFlow({
  currentSnapshot, snapshotRef, artifactId, entities, scaffoldOpts, validateBeforeSubmit, buildBody, setGenerating,
  pushRecent, setBaseline, setLastGenerated, showServerIssue, setToast,
}: GenerateFlowOptions) {
  // The in-flight Generate request, so the sticky bar's Cancel can abort it (and unmount does).
  const generateAbortRef = useRef<AbortController | null>(null)
  useEffect(() => () => generateAbortRef.current?.abort(), [])
  function cancelGenerate() {
    generateAbortRef.current?.abort()
  }

  /** Returns true when the ZIP downloaded successfully — lets the preview modal stay
   *  open (and show the error toast) on failure, and close only on success. */
  async function generate(): Promise<boolean> {
    if (!validateBeforeSubmit()) return false
    generateAbortRef.current?.abort()
    const controller = new AbortController()
    generateAbortRef.current = controller
    setGenerating(true)
    try {
      const body = buildBody()
      const res = await fetch('/starter-fullstack.zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The editor's own model rides along into the zip (menora-model.json), so Import JSON can
        // reopen the project as it is here — locked page ids and dismissed warnings included.
        body: JSON.stringify({ ...body, editorModel: toExportedModel(snapshotRef.current) }),
        signal: controller.signal,
      })
      if (!res.ok) {
        // The same reader Explore uses: detail, else the joined messages, else the error — and
        // where in the request the problem is.
        const failure = await readErrorBody(res)
        throw Object.assign(new Error(failure.message), { path: failure.path })
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${artifactId}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      pushRecent(currentSnapshot)
      // The project now in the user's hands was made from this model.
      setBaseline({
        snapshot: currentSnapshot, templatesHash: res.headers.get('X-Templates-Hash') ?? undefined,
        snapshotId: snapshotHeader(res.headers), schemaVersion: schemaVersionOf(res.headers.get('X-Schema-Version')),
        source: 'generated', at: Date.now(),
      })
      setToast({ message: t('Fullstack project downloaded'), type: 'success' })
      setLastGenerated({
        at: Date.now(),
        artifactId: artifactId || 'demo',
        entityCount: entities.length,
        endpoints: entities.flatMap(e => summarizeEntity(e, scaffoldOpts).endpoints.map(ep => ({ entity: e.name.trim() || 'Entity', ...ep }))),
        snapshot: currentSnapshot,
      })
      requestAnimationFrame(() => scrollToElement(document.querySelector<HTMLElement>('[data-next-steps]'), 'nearest'))
      return true
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setToast({ message: t('Generation cancelled'), type: 'success' })
        return false
      }
      const issue: ServerIssue = { message: (err as Error).message, path: (err as { path?: string }).path }
      const target = showServerIssue(issue)
      if (target && target.kind !== 'setting') {
        setToast({ message: t('Generation failed — the server rejected {what}', { what: describeServerTarget(target) }), type: 'error' })
      } else {
        setToast({ message: t('Generation failed: {error}', { error: issue.message }), type: 'error' })
      }
      return false
    } finally {
      // A newer Generate may already own the ref — only the request that set it clears the state.
      if (generateAbortRef.current === controller) {
        generateAbortRef.current = null
        setGenerating(false)
      }
    }
  }

  return { generate, cancelGenerate }
}
