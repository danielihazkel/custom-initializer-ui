import { useCallback, useMemo, useRef } from 'react'
import type {
  EntityTemplateSetSummary, ExampleSettings, FullstackEntityDef, FullstackNav, FullstackPageDef, FullstackStarterRequest,
} from '../../../types'
import { frontendSetDefaults } from '../../fullstack/frontendSetDefaults'
import { requestPages, validatePages, type PageLayoutValidation } from '../../fullstack/pageLayout'
import {
  DEFAULT_PROJECT_META, describeSnapshotChange, makeSnapshot, requestFromSnapshot, snapshotChangeKey,
  type FullstackSnapshot, type ProjectMeta,
} from '../../fullstack/snapshot'
import { useSnapshotHistory, type SnapshotHistory } from '../../fullstack/useSnapshotHistory'
import { showToast } from '../../../toast'
import { t } from '../../../i18n'
import type { ExampleDraft } from './FullstackExamplesTab'

/**
 * What the layout designer needs from the Admin examples form, which keeps an example as three
 * JSON texts: the parsed layout and its entities, the writes back into the texts, an undo stack
 * over them, and the request the example stands for. The Fullstack tab gives the designer the
 * same from its own state (`FullstackView`).
 */

/** The sets an example names none of — the Fullstack tab's own defaults. */
const DEFAULT_BACKEND_SET = 'spring-jpa-crud'
const DEFAULT_FRONTEND_SET = 'react-tailwind-crud'

/** What undo and redo put back: the two texts the designer writes, exactly as they were. */
interface DesignText {
  pagesText: string
  settingsText: string
}

/** The generated app's look, read from the example's settings and written back into them. */
export interface ExampleLook {
  frontendSet: string
  /** `set` (when the caller has the list) brings what picking it implies: Menora → Hebrew, RTL. */
  setFrontendSet: (setKey: string, set?: EntityTemplateSetSummary) => void
  /** '' = the set's default palette. */
  colorPalette: string
  setColorPalette: (id: string) => void
  locale: 'en' | 'he'
  dashboardTitle: string
  dashboardOverview: string
  updateMeta: (updates: Partial<ProjectMeta>) => void
  rtl: boolean
  toggleRtl: () => void
}

export interface ExampleDesign {
  entities: FullstackEntityDef[]
  pages: FullstackPageDef[]
  validation: PageLayoutValidation
  setPages: (next: FullstackPageDef[]) => void
  clearPages: () => void
  /** Files the texts as they are under `label`, before a change that is then not recorded again. */
  pushUndo: (label: string) => void
  nav: FullstackNav | undefined
  /** Absent, like `look`, while the settings are not a JSON object: there is nowhere to write to. */
  setNav?: (nav: FullstackNav | undefined) => void
  look: ExampleLook | null
  backendSet: string
  locale: 'en' | 'he'
  scaffold: string[]
  history: SnapshotHistory<DesignText>
  /** The generation request the example stands for, on `deps` (it names no dependencies itself). */
  request: (deps: string[]) => FullstackStarterRequest
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

/** A layout's text as pages; blank is no layout, and anything but an array is null. */
function parsePages(pagesText: string): FullstackPageDef[] | null {
  if (!pagesText.trim()) return []
  try {
    const pages: unknown = JSON.parse(pagesText)
    return Array.isArray(pages) ? pages as FullstackPageDef[] : null
  } catch {
    return null
  }
}

/** The settings' text as an object; blank is none, and anything but an object is null. */
function parseSettings(settingsText: string): ExampleSettings | null {
  if (!settingsText.trim()) return {}
  try {
    const settings: unknown = JSON.parse(settingsText)
    return settings && typeof settings === 'object' && !Array.isArray(settings) ? settings as ExampleSettings : null
  } catch {
    return null
  }
}

function scaffoldOf(settings: ExampleSettings): string[] {
  return Array.isArray(settings.scaffold) ? (settings.scaffold as unknown[]).filter((x): x is string => typeof x === 'string') : []
}

function navOf(settings: ExampleSettings): FullstackNav | undefined {
  return settings.nav && typeof settings.nav === 'object' ? settings.nav : undefined
}

/** An example as the editor's snapshot — the shape the undo labels and the request builder read. */
function snapshotOf(pages: FullstackPageDef[], settings: ExampleSettings, entities: FullstackEntityDef[] = [],
                    project: { artifactId?: string; name?: string; deps?: string[] } = {}): FullstackSnapshot {
  return makeSnapshot({
    meta: {
      ...DEFAULT_PROJECT_META,
      artifactId: project.artifactId || DEFAULT_PROJECT_META.artifactId,
      name: project.name ?? '',
      locale: settings.locale === 'he' ? 'he' : 'en',
      dashboardTitle: text(settings.dashboardTitle),
      dashboardOverview: text(settings.dashboardOverview),
    },
    entities,
    selectedDeps: project.deps ?? [],
    scaffoldOpts: scaffoldOf(settings),
    backendSet: text(settings.backendTemplateSet) || DEFAULT_BACKEND_SET,
    frontendSet: text(settings.frontendTemplateSet) || DEFAULT_FRONTEND_SET,
    colorPalette: text(settings.colorPalette),
    pages,
    nav: navOf(settings),
  })
}

function snapshotOfText(s: DesignText): FullstackSnapshot | null {
  const pages = parsePages(s.pagesText)
  const settings = parseSettings(s.settingsText)
  return pages && settings ? snapshotOf(pages, settings) : null
}

/** The settings as their text: no keys is no settings. */
function settingsToText(settings: ExampleSettings): string {
  return Object.keys(settings).length > 0 ? JSON.stringify(settings, null, 2) : ''
}

/** `settings` with `key` set, or without it when the value is blank. */
function withKey<K extends keyof ExampleSettings>(settings: ExampleSettings, key: K, value: ExampleSettings[K] | undefined | ''): ExampleSettings {
  const { [key]: _old, ...rest } = settings
  void _old
  return value === undefined || value === '' ? rest : { ...rest, [key]: value }
}

/**
 * Why the layout cannot be designed (the texts have to parse first), or everything the pages
 * card and the designer take. Call it once per form: it holds the undo stack.
 */
export function useExampleDesign(data: ExampleDraft, onChange: (updates: Partial<ExampleDraft>) => void): ExampleDesign | { error: string } {
  const pagesText = data.pagesText ?? ''
  const settingsText = data.settingsText ?? ''
  // The writes below keep their identity; what they read is as of the latest render — or, for
  // the settings, as of the write before it when two land in one event.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const settingsTextRef = useRef(settingsText)
  settingsTextRef.current = settingsText

  // The pages as the designer last handed them over, for as long as the text is still that
  // layout: the same objects keep their rows (selection, open cards) where a parse of the text
  // would make every page a new one.
  const writtenRef = useRef<{ text: string; pages: FullstackPageDef[] } | null>(null)

  const parsed = useMemo((): { entities: FullstackEntityDef[]; pages: FullstackPageDef[]; settings: ExampleSettings | null } | { error: string } => {
    let entities: unknown
    try { entities = JSON.parse(data.entitiesText || '[]') } catch { return { error: 'The entities are not valid JSON' } }
    if (!Array.isArray(entities)) return { error: 'The entities are not a JSON array' }
    const written = writtenRef.current
    let pages: FullstackPageDef[]
    if (written && written.text === pagesText) pages = written.pages
    else {
      let raw: unknown = []
      if (pagesText.trim()) {
        try { raw = JSON.parse(pagesText) } catch { return { error: 'The pages are not valid JSON' } }
      }
      if (!Array.isArray(raw)) return { error: 'The pages are not a JSON array' }
      pages = raw as FullstackPageDef[]
    }
    return {
      entities: (entities as FullstackEntityDef[])
        .filter(e => e && typeof e.name === 'string')
        .map(e => ({ ...e, fields: Array.isArray(e.fields) ? e.fields : [] })),
      pages,
      settings: parseSettings(settingsText),
    }
  }, [data.entitiesText, pagesText, settingsText])

  const current = useMemo((): DesignText => ({ pagesText, settingsText }), [pagesText, settingsText])
  const silentFromRef = useRef<DesignText | null>(null)
  const history = useSnapshotHistory<DesignText>({
    current,
    apply: useCallback((s: DesignText) => onChangeRef.current({ pagesText: s.pagesText, settingsText: s.settingsText }), []),
    equal: (a, b) => a.pagesText === b.pagesText && a.settingsText === b.settingsText,
    // The labels and the burst keys are the Fullstack tab's; text that does not parse (typed in
    // the JSON boxes) is one step of its own.
    changeKey: (prev, next) => {
      const a = snapshotOfText(prev); const b = snapshotOfText(next)
      return a && b ? snapshotChangeKey(a, b) : 'text'
    },
    describe: (prev, next) => {
      const a = snapshotOfText(prev); const b = snapshotOfText(next)
      return a && b ? describeSnapshotChange(a, b) : t('Edit')
    },
    silentFromRef,
    notify: message => showToast({ message, type: 'success' }),
  })

  const setPages = useCallback((next: FullstackPageDef[]) => {
    // The stored JSON is a request body, so the editor-only id lock stays out of it.
    const written = next.length ? JSON.stringify(requestPages(next), null, 2) : ''
    writtenRef.current = { text: written, pages: next }
    onChangeRef.current({ pagesText: written })
  }, [])

  const writeSettings = useCallback((change: (settings: ExampleSettings) => ExampleSettings) => {
    const settings = parseSettings(settingsTextRef.current)
    if (!settings) return
    const written = settingsToText(change(settings))
    settingsTextRef.current = written
    onChangeRef.current({ settingsText: written })
  }, [])

  const { pushUndoEntry } = history
  const exampleId = data.exampleId
  const name = data.name
  const validation = useMemo(
    () => ('error' in parsed ? null : validatePages(parsed.pages, parsed.entities, { scaffoldOpts: parsed.settings ? scaffoldOf(parsed.settings) : [] })),
    [parsed],
  )

  return useMemo((): ExampleDesign | { error: string } => {
    if ('error' in parsed) return parsed
    // (Never: the validation is worked out from the same parse.)
    if (!validation) return { error: 'The pages cannot be read' }
    const { entities, pages } = parsed
    const settings = parsed.settings ?? {}
    const editable = parsed.settings !== null
    const scaffold = scaffoldOf(settings)
    const locale = settings.locale === 'he' ? 'he' : 'en'
    const look: ExampleLook = {
      frontendSet: text(settings.frontendTemplateSet) || DEFAULT_FRONTEND_SET,
      setFrontendSet: (setKey, set) => writeSettings(s => {
        if ((text(s.frontendTemplateSet) || DEFAULT_FRONTEND_SET) === setKey) return s
        // A brand set implies its language and direction, as on the Fullstack tab.
        const implied = frontendSetDefaults(set)
        let next = withKey(s, 'frontendTemplateSet', setKey)
        if (implied.locale) next = withKey(next, 'locale', implied.locale)
        if (implied.rtl && !scaffoldOf(next).includes('rtl')) next = withKey(next, 'scaffold', [...scaffoldOf(next), 'rtl'])
        return next
      }),
      colorPalette: text(settings.colorPalette),
      setColorPalette: id => writeSettings(s => withKey(s, 'colorPalette', id)),
      locale,
      dashboardTitle: text(settings.dashboardTitle),
      dashboardOverview: text(settings.dashboardOverview),
      updateMeta: updates => writeSettings(s => {
        let next = s
        if (updates.locale !== undefined) next = withKey(next, 'locale', updates.locale)
        if (updates.dashboardTitle !== undefined) next = withKey(next, 'dashboardTitle', updates.dashboardTitle)
        if (updates.dashboardOverview !== undefined) next = withKey(next, 'dashboardOverview', updates.dashboardOverview)
        return next
      }),
      rtl: scaffold.includes('rtl'),
      // No options left is no `scaffold` key: an example without one leaves the user's options alone.
      toggleRtl: () => writeSettings(s => {
        const opts = scaffoldOf(s)
        const next = opts.includes('rtl') ? opts.filter(o => o !== 'rtl') : [...opts, 'rtl']
        return withKey(s, 'scaffold', next.length ? next : undefined)
      }),
    }
    return {
      entities,
      pages,
      validation,
      setPages,
      clearPages: () => { pushUndoEntry(t('Switched to the classic page layout')); setPages([]) },
      pushUndo: pushUndoEntry,
      nav: navOf(settings),
      setNav: editable ? nav => writeSettings(s => withKey(s, 'nav', nav)) : undefined,
      look: editable ? look : null,
      backendSet: text(settings.backendTemplateSet) || DEFAULT_BACKEND_SET,
      locale,
      scaffold,
      history,
      request: deps => requestFromSnapshot(snapshotOf(pages, settings, entities, { artifactId: exampleId?.trim(), name: name?.trim(), deps })),
    }
  }, [parsed, validation, history, pushUndoEntry, setPages, writeSettings, exampleId, name])
}
