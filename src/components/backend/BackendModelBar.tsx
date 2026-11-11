import { useRef } from 'react'
import { BackendUpdatePanel } from './BackendUpdatePanel'
import type { useBackendUpdate } from './useBackendUpdate'

interface Props {
  update: ReturnType<typeof useBackendUpdate>
}

/**
 * Above the Backend tab's form: *Import model…* (a generated project's `menora-model.json`) and,
 * while the model differs from the one a project was generated from, the update panel.
 */
export function BackendModelBar({ update }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

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
    <div className="mb-4 space-y-3" data-backend-model-bar>
      <div className="flex items-center justify-end gap-2">
        <span className="text-[11px] text-secondary">
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
      {update.offered && update.baseline && (
        <BackendUpdatePanel
          baseline={update.baseline}
          busy={update.busy}
          onDownload={() => { void update.downloadUpdate() }}
          onMarkApplied={update.markApplied}
          onForget={update.forget}
        />
      )}
    </div>
  )
}
