import { Suspense, lazy, useEffect, useState } from 'react'
import type { EntityCodeFile } from './entityCode'

const ReadOnlyCodeViewer = lazy(() => import('../ReadOnlyCodeViewer').then(m => ({ default: m.ReadOnlyCodeViewer })))

/**
 * The generated code for one entity, read out of the last Explore preview.
 *
 * The card's endpoint list says what *will* exist; this says what it looks like. Pairing them on
 * the same card is the point — it is the difference between trusting the generator and seeing it.
 * There is no fetch here: the preview payload already carries every file's content.
 */
export interface EntityCodePanelProps {
  files: EntityCodeFile[]
  /** True once a preview has been fetched — distinguishes "no code" from "no preview yet". */
  hasPreview: boolean
  previewLoading: boolean
  onExplore: () => void
  /** True when the model changed since the preview, so the code shown may be out of date. */
  stale?: boolean
}

export function EntityCodePanel({ files, hasPreview, previewLoading, onExplore, stale }: EntityCodePanelProps) {
  const [activePath, setActivePath] = useState<string | null>(null)
  // A file can vanish between previews (drop the `tests` opt and the test file goes); fall back to
  // the first rather than showing an empty viewer.
  const active = files.find(f => f.path === activePath) ?? files[0]
  useEffect(() => {
    if (active && active.path !== activePath) setActivePath(active.path)
  }, [active, activePath])

  if (!hasPreview) {
    return (
      <div className="rounded-lg border border-outline-variant bg-background/50 px-3 py-4 text-center space-y-2" data-entity-code>
        <p className="text-[11px] text-secondary">
          Run Explore to see the code this entity generates.
        </p>
        <button
          type="button"
          onClick={onExplore}
          disabled={previewLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:opacity-90 disabled:opacity-60"
        >
          {previewLoading
            ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '14px' }}>progress_activity</span>
            : <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>travel_explore</span>}
          Explore
        </button>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-outline-variant bg-background/50 px-3 py-4 text-[11px] text-secondary text-center" data-entity-code>
        The last preview generated no files for this entity — rename it or re-run Explore.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-outline-variant bg-background/50 overflow-hidden" data-entity-code>
      {stale && (
        <p className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-warning border-b border-outline-variant" role="status">
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>update</span>
          The model changed since this preview — re-run Explore to refresh.
        </p>
      )}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-outline-variant overflow-x-auto custom-scrollbar" role="tablist" aria-label="Generated files">
        {files.map(file => (
          <button
            key={file.path}
            type="button"
            role="tab"
            aria-selected={file.path === active?.path}
            onClick={() => setActivePath(file.path)}
            title={file.path}
            className={`shrink-0 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
              file.path === active?.path
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-secondary hover:text-on-surface hover:bg-primary/5'}`}
          >
            {file.name}
          </button>
        ))}
      </div>
      {active && (
        <>
          <p className="px-3 py-1 text-[10px] font-mono text-secondary truncate border-b border-outline-variant" title={active.path}>
            {active.path}
          </p>
          <div className="max-h-[26rem] overflow-auto custom-scrollbar">
            <Suspense fallback={<div className="p-4 text-[11px] text-secondary">Loading viewer…</div>}>
              <ReadOnlyCodeViewer code={active.content} targetPath={active.path} />
            </Suspense>
          </div>
        </>
      )}
    </div>
  )
}
