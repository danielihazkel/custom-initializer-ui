import type { ReactNode } from 'react'
import type { EntityTemplateSetSummary } from '../../../types'
import type { FeColorPalette } from '../../../hooks/useFrontendMetadata'
import { PalettePicker } from '../../shared/PalettePicker'
import { SetDescription, SetLabel, inputClass } from '../controls'
import { RTL_OPTION } from '../scaffoldOptions'
import type { ProjectMeta } from '../snapshot'

/** Everything that decides how the generated React app looks, with its setters — owned by
 *  FullstackView (so undo, share links and drafts keep covering it) and edited in the layout
 *  designer's Appearance view. */
export interface FrontendAppearance {
  frontendSets: EntityTemplateSetSummary[]
  frontendSet: string
  setFrontendSet: (setKey: string) => void
  currentFrontendSet?: EntityTemplateSetSummary
  setsLoading: boolean
  setsError: string | null
  loadTemplateSets: () => void
  palettes: FeColorPalette[]
  feError: string | null
  reloadFe: () => void
  /** The palette in force — the explicit pick, else the set's default. */
  effectivePalette: string
  setDefaultPalette: string
  /** The explicit pick ('' = the set's default). */
  colorPalette: string
  setColorPalette: (id: string) => void
  locale: ProjectMeta['locale']
  dashboardTitle: string
  dashboardOverview: string
  /** The dashboard title's placeholder names the project. */
  artifactId: string
  updateMeta: (updates: Partial<ProjectMeta>) => void
  rtl: boolean
  toggleRtl: () => void
}

/** True for the Menora Digital set — the white top-bar shell with fixed brand colours. */
export function isMenoraSet(set: EntityTemplateSetSummary | undefined, setKey: string): boolean {
  return set?.designSystem === 'MENORA_DIGITAL' || setKey.includes('menora')
}

function Group({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5" aria-label={title}>
      <div>
        <h3 className="text-xs font-semibold text-on-surface">{title}</h3>
        <p className="text-[11px] text-secondary">{hint}</p>
      </div>
      {children}
    </section>
  )
}

/** A thumbnail of a set's shell: the tailwind sets' dark sidebar, or Menora Digital's white top bar. */
function ShellSketch({ menora }: { menora: boolean }) {
  return menora ? (
    <span aria-hidden="true" className="flex h-12 w-16 shrink-0 flex-col overflow-hidden rounded border border-outline-variant bg-[#f4f4f8]">
      <span className="flex h-2.5 items-center gap-0.5 bg-white px-1"><span className="h-1 w-2 rounded-sm bg-[#684eed]" /><span className="h-1 w-3 rounded-sm bg-[#37374e]/30" /></span>
      <span className="m-1 flex-1 rounded-sm bg-white" />
      <span className="h-1.5 bg-[#37374e]" />
    </span>
  ) : (
    <span aria-hidden="true" className="flex h-12 w-16 shrink-0 overflow-hidden rounded border border-outline-variant bg-[#f3f4f8]">
      <span className="w-4 bg-[#2B2F4C]" />
      <span className="m-1 flex-1 rounded-sm bg-white" />
    </span>
  )
}

/**
 * The generated app's look: template set, colours, language and direction, and the classic
 * dashboard's heading. Every group says what it changes in the preview beside it.
 */
export function FrontendSettings({ appearance: a, hasPages, onEditStartDashboard }: {
  appearance: FrontendAppearance
  hasPages: boolean
  /** With a layout: opens its first dashboard page, where the heading now lives. */
  onEditStartDashboard?: () => void
}) {
  const menora = isMenoraSet(a.currentFrontendSet, a.frontendSet)
  return (
    <div className="space-y-6" data-frontend-settings>
      <Group title="Look" hint="The template set draws the whole app — its shell, navigation and components.">
        {a.setsError && (
          <div className="flex items-center justify-between gap-3 rounded border border-error/30 bg-error/10 px-3 py-2 text-[11px] text-error">
            <span>Couldn't load template sets ({a.setsError}); showing defaults.</span>
            <button type="button" onClick={a.loadTemplateSets} disabled={a.setsLoading} className="shrink-0 rounded-lg border border-error/40 px-2.5 py-1 text-xs font-medium hover:bg-error/10 disabled:opacity-60">
              Retry
            </button>
          </div>
        )}
        {a.setsLoading ? (
          <div className="h-[58px] animate-pulse rounded bg-surface-container-low" aria-hidden="true" />
        ) : a.frontendSets.length > 1 ? (
          <div role="radiogroup" aria-label="Frontend template set" className="space-y-1.5" id="fs-frontendSet">
            {a.frontendSets.map(s => {
              const on = s.setKey === a.frontendSet
              return (
                <button
                  key={s.setKey}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => a.setFrontendSet(s.setKey)}
                  className={`flex w-full items-start gap-3 rounded-lg border-2 p-2.5 text-start transition-colors ${on ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary/40'}`}
                  data-frontend-set={s.setKey}
                >
                  <ShellSketch menora={isMenoraSet(s, s.setKey)} />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-on-surface">{s.name}</span>
                    {s.description?.trim() && <span className="line-clamp-2 text-[11px] text-secondary" title={s.description}>{s.description}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <>
            <SetLabel name={a.currentFrontendSet?.name} setKey={a.frontendSet} />
            <SetDescription set={a.currentFrontendSet} />
          </>
        )}
      </Group>

      <Group title="Colours" hint={menora ? 'Menora Digital keeps its brand colours; the palette only feeds the success and danger accents.' : 'The shell, buttons and charts take the palette’s two colours.'}>
        {a.feError && a.palettes.length === 0 && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-on-surface" data-palette-error>
            <span>Couldn't load the colour palettes ({a.feError}); the generated app uses the set's default palette.</span>
            <button type="button" onClick={a.reloadFe} className="shrink-0 rounded-lg border border-error/40 px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10">Retry</button>
          </div>
        )}
        {a.palettes.length > 0 && (
          <PalettePicker
            label="Frontend colour palette"
            palettes={a.palettes}
            selectedId={a.effectivePalette}
            onChange={id => a.setColorPalette(id === a.setDefaultPalette ? '' : id)}
            caption={a.colorPalette
              ? <button type="button" onClick={() => a.setColorPalette('')} className="underline hover:no-underline">use the set's default</button>
              : '(set default)'}
          />
        )}
      </Group>

      <Group title="Language & direction" hint="The app's own words — menus, buttons, dialogs, empty states. Your entity and field labels stay exactly as typed.">
        <div role="radiogroup" aria-label="Language" id="fs-locale" className="flex gap-0.5 rounded-lg border border-outline-variant bg-surface-container p-0.5">
          {([['en', 'English'], ['he', 'עברית']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={a.locale === value}
              onClick={() => a.updateMeta({ locale: value })}
              className={`flex-1 rounded-md py-1.5 text-xs ${a.locale === value ? 'bg-surface-container-high font-semibold text-on-surface' : 'text-secondary hover:text-on-surface'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-outline-variant p-3 transition-colors hover:border-primary/50">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={a.rtl} onChange={a.toggleRtl} aria-label={RTL_OPTION.label} />
          <span className="flex flex-col">
            <span className="text-sm text-on-surface">{RTL_OPTION.label}</span>
            <span className="text-[11px] text-secondary">{RTL_OPTION.hint}</span>
          </span>
        </label>
      </Group>

      <Group title="Classic dashboard" hint={hasPages ? 'Your page layout is in charge: each dashboard page has its own title and description.' : 'The heading of the home page the app gets without a page layout.'}>
        {hasPages ? (
          <div className="space-y-2" data-dashboard-meta-note>
            <p className="text-[11px] text-secondary">These two only apply to the classic layout, so they are off while you have pages.</p>
            {onEditStartDashboard && (
              <button type="button" onClick={onEditStartDashboard} className="text-xs font-semibold text-primary hover:underline">
                Edit the dashboard page’s title
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1" htmlFor="fs-dashboardTitle">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Dashboard title</span>
              <input
                id="fs-dashboardTitle"
                className={inputClass()}
                value={a.dashboardTitle}
                placeholder={`Welcome to ${a.artifactId || 'demo'}`}
                onChange={e => a.updateMeta({ dashboardTitle: e.target.value })}
              />
            </label>
            <label className="block space-y-1" htmlFor="fs-dashboardOverview">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Dashboard overview</span>
              <input
                id="fs-dashboardOverview"
                className={inputClass()}
                value={a.dashboardOverview}
                placeholder="Manage your data below…"
                onChange={e => a.updateMeta({ dashboardOverview: e.target.value })}
              />
            </label>
          </div>
        )}
      </Group>
    </div>
  )
}
