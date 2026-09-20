import { useEffect, useRef, useState } from 'react'
import type { EditorDensity } from './EntitiesEditor'
import type { ImportVariant } from './ImportFromDdlDrawer'
import { SectionHeading } from './controls'

/**
 * The model workspace's command strip, pinned under the app header.
 *
 * The controls it replaces had four different visual vocabularies — an icon toggle, a segmented
 * control, a ghost button and two outlined buttons — and wrapped unpredictably. There are exactly
 * three primitives here and nothing else, so a control's shape tells you what kind of thing it is:
 * a segmented group switches between mutually exclusive states, a ghost button performs an action,
 * and the single filled button is the one thing you do most.
 */
const TB_BTN = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-secondary hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-secondary'
const TB_GROUP = 'inline-flex h-8 rounded-lg border border-outline-variant overflow-hidden text-xs'
const TB_SEG = 'px-2.5 transition-colors'
const TB_CTA = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:opacity-90 active:scale-95 transition-all'

export type WorkspaceLayout = 'cards' | 'diagram'

export interface EntitiesToolbarProps {
  entityCount: number
  density: EditorDensity
  onDensityChange: (density: EditorDensity) => void
  layout: WorkspaceLayout
  onLayoutChange: (layout: WorkspaceLayout) => void
  allCollapsed: boolean
  onToggleCollapseAll: () => void
  onImport: (variant: ImportVariant) => void
  onAddEntity: () => void
  canUndo: boolean
  canRedo: boolean
  /** Full "Undo: renamed Invoice" text, or null when there is nothing to undo. */
  undoLabel: string | null
  redoLabel: string | null
  onUndo: () => void
  onRedo: () => void
  onShortcuts: () => void
  errorCount: number
  onJumpToFirstError: () => void
}

export function EntitiesToolbar({
  entityCount, density, onDensityChange, layout, onLayoutChange,
  allCollapsed, onToggleCollapseAll, onImport, onAddEntity,
  canUndo, canRedo, undoLabel, redoLabel, onUndo, onRedo, onShortcuts,
  errorCount, onJumpToFirstError,
}: EntitiesToolbarProps) {
  const [importOpen, setImportOpen] = useState(false)
  const importRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!importOpen) return
    function onDocument(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setImportOpen(false)
        return
      }
      if (!importRef.current?.contains(e.target as Node)) setImportOpen(false)
    }
    document.addEventListener('mousedown', onDocument)
    document.addEventListener('keydown', onDocument)
    return () => {
      document.removeEventListener('mousedown', onDocument)
      document.removeEventListener('keydown', onDocument)
    }
  }, [importOpen])

  function runImport(variant: ImportVariant) {
    setImportOpen(false)
    onImport(variant)
  }

  return (
    // The negative-margin/px pair lets the glass backdrop bleed to the column edges, the same
    // trick the old bottom bar used. `top-16` parks it directly under the fixed app header.
    <div className="sticky top-16 z-30 -mx-8 px-8 py-2 glass-header border-b border-outline-variant flex items-center gap-2 flex-wrap md:flex-nowrap">
      <SectionHeading icon="table" title="Entities" primary />
      <span className="inline-flex items-center h-6 px-2 rounded-full bg-primary/10 text-primary text-[11px] font-semibold tabular-nums shrink-0">
        {entityCount}
      </span>
      {errorCount > 0 && (
        <button
          type="button"
          id="fs-blocked-reason"
          onClick={onJumpToFirstError}
          className={`${TB_BTN} text-error hover:text-error hover:bg-error/10 shrink-0`}
          title="Jump to the first problem"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
          {errorCount} issue{errorCount === 1 ? '' : 's'} to fix before generating
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
        </button>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {entityCount > 0 && (
          <div className={TB_GROUP} role="group" aria-label="Workspace layout" title="Cards edit the model; Diagram shows the entities and their @ManyToOne relations">
            {(['cards', 'diagram'] as const).map(l => (
              <button
                key={l}
                type="button"
                aria-pressed={layout === l}
                onClick={() => onLayoutChange(l)}
                className={`${TB_SEG} ${layout === l ? 'bg-primary text-on-primary' : 'bg-background text-secondary hover:text-on-surface'}`}
              >
                {l === 'cards' ? 'Cards' : 'Diagram'}
              </button>
            ))}
          </div>
        )}

        <div className={TB_GROUP} role="group" aria-label="Field table density" title="Compact hides the Label column (labels move into each field's More panel) and tightens the rows">
          {(['comfortable', 'compact'] as const).map(d => (
            <button
              key={d}
              type="button"
              aria-pressed={density === d}
              onClick={() => onDensityChange(d)}
              className={`${TB_SEG} ${density === d ? 'bg-primary text-on-primary' : 'bg-background text-secondary hover:text-on-surface'}`}
            >
              {d === 'compact' ? 'Compact' : 'Comfortable'}
            </button>
          ))}
        </div>

        {entityCount > 1 && (
          <button
            type="button"
            onClick={onToggleCollapseAll}
            className={TB_BTN}
            aria-label={allCollapsed ? 'Expand every entity card' : 'Collapse every entity card to its header'}
            title={allCollapsed ? 'Expand every entity card' : 'Collapse every entity card to its header'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{allCollapsed ? 'unfold_more' : 'unfold_less'}</span>
          </button>
        )}

        <span className="h-4 w-px bg-outline-variant shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={TB_BTN}
          title={undoLabel ? `${undoLabel} (Ctrl+Z)` : 'Nothing to undo'}
          aria-label={undoLabel ?? 'Undo (nothing to undo)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>undo</span>
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={TB_BTN}
          title={redoLabel ? `${redoLabel} (Ctrl+Shift+Z / Ctrl+Y)` : 'Nothing to redo'}
          aria-label={redoLabel ?? 'Redo (nothing to redo)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>redo</span>
        </button>

        <div className="relative" ref={importRef}>
          <button
            type="button"
            onClick={() => setImportOpen(o => !o)}
            aria-expanded={importOpen}
            aria-haspopup="menu"
            className={TB_BTN}
            title="Build entities from existing SQL"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload_file</span>
            Import
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>expand_more</span>
          </button>
          {importOpen && (
            <div role="menu" className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-outline-variant bg-surface-container shadow-lg py-1 z-40">
              <button
                type="button"
                role="menuitem"
                onClick={() => runImport('ddl')}
                className="flex items-start gap-2 w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-primary/5"
              >
                <span className="material-symbols-outlined text-secondary mt-0.5" style={{ fontSize: '16px' }}>database</span>
                <span>
                  From DDL
                  <span className="block text-[11px] text-secondary">CREATE TABLE → entities</span>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runImport('select')}
                className="flex items-start gap-2 w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-primary/5"
              >
                <span className="material-symbols-outlined text-secondary mt-0.5" style={{ fontSize: '16px' }}>table_view</span>
                <span>
                  From SELECT
                  <span className="block text-[11px] text-secondary">One query → a read-only view</span>
                </span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onShortcuts}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className={TB_BTN}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>keyboard</span>
        </button>

        <button type="button" onClick={onAddEntity} className={TB_CTA} title="Add an entity (Ctrl+Shift+A)">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
          Add entity
        </button>
      </div>
    </div>
  )
}
