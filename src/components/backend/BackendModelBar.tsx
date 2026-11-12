import { Suspense, lazy, useEffect, useRef, type ReactNode } from 'react'
import { registerCommands } from '../../commands'
// Shown only while an update is on offer — not part of what the tab needs to paint.
const BackendUpdatePanel = lazy(() => import('./BackendUpdatePanel').then(m => ({ default: m.BackendUpdatePanel })))
import type { useBackendUpdate } from './useBackendUpdate'

interface Props {
  update: ReturnType<typeof useBackendUpdate>
  /** The tab's heading, drawn at the start of the row the import button ends. */
  children?: ReactNode
}

/**
 * Above the Backend tab's form: *Import model…* (a generated project's `menora-model.json`) and,
 * while the model differs from the one a project was generated from, the update panel.
 */
export function BackendModelBar({ update, children }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  // ⌘K reaches the import too.
  useEffect(() => registerCommands([{
    id: 'backend-import-model', title: 'Import a project’s menora-model.json…',
    description: 'Reopen a generated project to change it and download an update',
    icon: 'upload_file', group: 'Backend', run: () => fileRef.current?.click(),
  }], 'backend-model'), [])

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') update.importModel(reader.result)
    }
    reader.readAsText(file)
  }

  return (
    <div className="mb-6 space-y-3" data-backend-model-bar>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {children ?? <span />}
        <div className="flex items-center gap-2 ml-auto">
        <span className="hidden sm:inline text-[11px] text-secondary">
          Have a generated project? Open its <span className="font-mono">menora-model.json</span>.
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-primary/10 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden>upload_file</span>
          Import model…
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile}
               aria-label="A project's menora-model.json" />
        </div>
      </div>
      {update.offered && update.baseline && (
        <Suspense fallback={null}>
          <BackendUpdatePanel
            baseline={update.baseline}
            busy={update.busy}
            onDownload={() => { void update.downloadUpdate() }}
            onMarkApplied={update.markApplied}
            onForget={update.forget}
          />
        </Suspense>
      )}
    </div>
  )
}
