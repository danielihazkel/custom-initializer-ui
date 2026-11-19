import type { UpdateBaseline } from './updateBaseline'
import { t } from '../../i18n'

interface Props {
  baseline: UpdateBaseline
  /** The update or its preview is being fetched. */
  busy: boolean
  onPreview: () => void
  onDownload: () => void
  /** The team applied the last update: the current model becomes the baseline. */
  onMarkApplied: () => void
  onForget: () => void
}

const BUTTON = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50'

/**
 * Shown while the model differs from the one an existing project was generated from: instead of
 * generating again — which would overwrite what the team has changed in the code since — it
 * offers the difference as a patch to merge.
 */
export function UpdatePanel({ baseline, busy, onPreview, onDownload, onMarkApplied, onForget }: Props) {
  const name = baseline.snapshot.meta.artifactId?.trim() || t('the project')
  const when = baseline.at ? new Date(baseline.at).toLocaleDateString() : ''
  const vars = { name, when }
  const since = baseline.source === 'imported'
    ? (when ? t('The model has changed since {name} was imported ({when}).', vars) : t('The model has changed since {name} was imported.', vars))
    : (when ? t('The model has changed since {name} was generated ({when}).', vars) : t('The model has changed since {name} was generated.', vars))
  return (
    <section
      data-update-panel
      aria-label={t('Update an existing project')}
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 flex flex-wrap items-center gap-x-4 gap-y-3"
    >
      <span className="material-symbols-outlined text-primary" style={{ fontSize: '22px' }} aria-hidden>difference</span>
      <div className="min-w-[16rem] flex-1">
        <p className="text-sm font-semibold text-on-surface">{t('Update the project you already have')}</p>
        <p className="mt-0.5 text-xs text-secondary">
          {since}{' '}
          {t('Generating again would overwrite edits made to the code since — an update is a patch of just what the model change does, for')}{' '}
          <span className="font-mono" dir="ltr">git apply --3way</span>.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onPreview} disabled={busy} className={`${BUTTON} border border-outline-variant text-on-surface hover:bg-primary/10`}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden>visibility</span>
          {t('Preview changes')}
        </button>
        <button type="button" onClick={onDownload} disabled={busy} className={`${BUTTON} bg-primary text-on-primary hover:opacity-90`}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden>download</span>
          {busy ? t('Working…') : t('Download update')}
        </button>
        <button type="button" onClick={onMarkApplied} disabled={busy} className={`${BUTTON} text-secondary hover:text-on-surface hover:bg-primary/10`}
                title={t('The project now matches this model (you applied an update, or generated it elsewhere): later updates start from here')}>
          {t('Mark as applied')}
        </button>
        <button type="button" onClick={onForget} disabled={busy} className={`${BUTTON} text-secondary hover:text-error hover:bg-error/10`}
                title={t("Stop tracking a project: this panel goes away until the next Generate or Import JSON of a project's menora-model.json")}>
          {t('Forget')}
        </button>
      </div>
    </section>
  )
}
