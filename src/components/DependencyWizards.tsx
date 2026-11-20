import { useEffect, lazy, Suspense } from 'react'
import type { EventsByDep, EventsWizardEntry, MetadataOption, OpenApiByDep, OpenApiWizardEntry, PreviewError, SoapByDep, SoapWizardEntry, SqlByDep, SqlDialects, SqlWizardEntry } from '../types'
import { requiredSqlDeps, isSqlDepSatisfied } from '../utils/projectUtils'
import { registerCommands, type PaletteAction } from '../commands'
import { t, useLang } from '../i18n'

// The wizard drawers embed a CodeMirror editor (~1 MB of grammars); each is loaded only when it
// is actually opened.
const SqlWizardDrawer = lazy(() => import('./SqlWizardDrawer').then(m => ({ default: m.SqlWizardDrawer })))
const OpenApiWizardDrawer = lazy(() => import('./OpenApiWizardDrawer').then(m => ({ default: m.OpenApiWizardDrawer })))
const SoapWizardDrawer = lazy(() => import('./SoapWizardDrawer').then(m => ({ default: m.SoapWizardDrawer })))
const EventsWizardDrawer = lazy(() => import('./EventsWizardDrawer').then(m => ({ default: m.EventsWizardDrawer })))

/** The four wizards a dependency can have. */
export type WizardKind = 'sql' | 'openapi' | 'soap' | 'events'
/** The dependency each wizard is open on, if any. */
export type OpenWizards = Partial<Record<WizardKind, string>>

interface Props {
  allDeps: MetadataOption[]
  selectedDeps: MetadataOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  /** Which wizard is open on which dependency — kept by the picker, whose buttons set it. */
  open: OpenWizards
  onOpen: (kind: WizardKind, depId: string | null) => void
  focusSearch: () => void
  sqlDialects: SqlDialects
  sqlByDep: SqlByDep
  onSqlByDepChange: (depId: string, entry: SqlWizardEntry | null) => void
  openApiCapableDeps: string[]
  openApiByDep: OpenApiByDep
  onOpenApiByDepChange: (depId: string, entry: OpenApiWizardEntry | null) => void
  soapCapableDeps: string[]
  soapByDep: SoapByDep
  onSoapByDepChange: (depId: string, entry: SoapWizardEntry | null) => void
  eventsCapableDeps: string[]
  eventsByDep: EventsByDep
  onEventsByDepChange?: (depId: string, entry: EventsWizardEntry | null) => void
  sqlParseError?: PreviewError | null
}

/**
 * The dependency picker's wizards, apart from the picker: the four drawers and the ⌘K entries
 * that open them (and the search box). Nothing here is drawn until a wizard opens, so the picker
 * — first-paint code — mounts it as a lazy chunk and only keeps which wizard is open.
 */
export function DependencyWizards({
  allDeps, selectedDeps, selected, onChange, open, onOpen, focusSearch,
  sqlDialects, sqlByDep, onSqlByDepChange,
  openApiCapableDeps, openApiByDep, onOpenApiByDepChange,
  soapCapableDeps, soapByDep, onSoapByDepChange,
  eventsCapableDeps, eventsByDep, onEventsByDepChange,
  sqlParseError,
}: Props) {
  const lang = useLang()

  // ⌘K: the search box, and the wizard of every selected dependency that has one.
  useEffect(() => {
    const list: PaletteAction[] = [{
      id: 'backend-search-deps', title: t('Search dependencies'), icon: 'search', group: t('Backend'),
      shortcut: '/', run: focusSearch,
    }]
    for (const dep of selectedDeps) {
      const wizard = (kind: WizardKind, title: string, icon: string) => list.push({
        id: `backend-wizard-${kind}-${dep.id}`, title, icon, group: t('Wizards'), run: () => onOpen(kind, dep.id),
      })
      if (sqlDialects[dep.id]) wizard('sql', t('{dep}: generate entities from SQL…', { dep: dep.name }), 'auto_fix_high')
      if (openApiCapableDeps.includes(dep.id)) wizard('openapi', t('{dep}: generate from an OpenAPI spec…', { dep: dep.name }), 'integration_instructions')
      if (soapCapableDeps.includes(dep.id)) wizard('soap', t('{dep}: generate from a WSDL…', { dep: dep.name }), 'hub')
      if (eventsCapableDeps.includes(dep.id)) wizard('events', t('{dep}: generate from an AsyncAPI document…', { dep: dep.name }), 'cell_tower')
    }
    return registerCommands(list, 'backend-deps')
  }, [selectedDeps, sqlDialects, openApiCapableDeps, soapCapableDeps, eventsCapableDeps, focusSearch, onOpen, lang])

  const depOf = (kind: WizardKind) => (open[kind] ? allDeps.find(d => d.id === open[kind]) : null)
  const wizardDep = depOf('sql')
  const openApiWizardDep = depOf('openapi')
  const soapWizardDep = depOf('soap')
  const eventsWizardDep = depOf('events')

  return (
    <Suspense fallback={null}>
      {wizardDep && (
        <SqlWizardDrawer
          isOpen
          onClose={() => onOpen('sql', null)}
          depId={wizardDep.id}
          depName={wizardDep.name}
          dialectName={sqlDialects[wizardDep.id] ?? ''}
          initial={sqlByDep[wizardDep.id] ?? null}
          selected={selected}
          onSave={entry => {
            onSqlByDepChange(wizardDep.id, entry)
            if (entry) {
              const missing = requiredSqlDeps(entry.apiMode ?? 'NONE')
                .filter(d => !isSqlDepSatisfied(d, selected))
              if (missing.length) onChange([...selected, ...missing])
            }
          }}
          parseError={sqlParseError && sqlParseError.dep === wizardDep.id ? sqlParseError : null}
        />
      )}
      {openApiWizardDep && (
        <OpenApiWizardDrawer
          isOpen
          onClose={() => onOpen('openapi', null)}
          depId={openApiWizardDep.id}
          depName={openApiWizardDep.name}
          initial={openApiByDep[openApiWizardDep.id] ?? null}
          onSave={entry => onOpenApiByDepChange(openApiWizardDep.id, entry)}
        />
      )}
      {soapWizardDep && (
        <SoapWizardDrawer
          isOpen
          onClose={() => onOpen('soap', null)}
          depId={soapWizardDep.id}
          depName={soapWizardDep.name}
          initial={soapByDep[soapWizardDep.id] ?? null}
          onSave={entry => onSoapByDepChange(soapWizardDep.id, entry)}
        />
      )}
      {eventsWizardDep && (
        <EventsWizardDrawer
          isOpen
          onClose={() => onOpen('events', null)}
          depId={eventsWizardDep.id}
          depName={eventsWizardDep.name}
          initial={eventsByDep[eventsWizardDep.id] ?? null}
          onSave={entry => onEventsByDepChange?.(eventsWizardDep.id, entry)}
        />
      )}
    </Suspense>
  )
}
