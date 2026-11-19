import type { FullstackEntityDef, FullstackNav } from '../../../types'
import { NAV_TOOLS, cleanNav, navToolDisabledReason } from '../navTools'
import { t } from '../../../i18n'

/**
 * The header's tools of a page layout — the palette, the bell and the user menu — as three
 * switches. Both template sets take them; a tool the model cannot have is disabled with the reason.
 */
export function NavToolsFields({ nav, entities, onNavChange, stacked }: {
  nav?: FullstackNav
  entities: readonly FullstackEntityDef[]
  onNavChange: (nav: FullstackNav | undefined) => void
  /** One switch a line with its hint under it (the sitemap's side panel); otherwise a row of them. */
  stacked?: boolean
}) {
  return (
    <div
      className={stacked ? 'space-y-2' : 'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-outline-variant px-2 py-1'}
      data-nav-tools
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary" title={t("What the generated app's header carries beside its theme switch")}>
        {t('Header tools')}
      </span>
      {NAV_TOOLS.map(tool => {
        const reason = navToolDisabledReason(tool.value, entities)
        return (
          <label
            key={tool.value}
            className={`${stacked ? 'flex items-start gap-2 text-xs' : 'inline-flex items-center gap-1.5 text-[11px]'} ${reason ? 'text-secondary' : 'text-on-surface'}`}
            title={reason ?? tool.hint}
          >
            <input
              type="checkbox"
              className={`${stacked ? 'mt-0.5 ' : ''}accent-primary`}
              checked={Boolean(nav?.[tool.value]) && !reason}
              disabled={Boolean(reason)}
              aria-label={tool.label}
              onChange={e => onNavChange(cleanNav({ ...nav, [tool.value]: e.target.checked }))}
            />
            {stacked
              ? <span>{tool.label}<span className="block text-[11px] text-secondary">{reason ?? tool.hint}</span></span>
              : tool.label}
          </label>
        )
      })}
    </div>
  )
}
